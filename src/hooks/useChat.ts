import { useState, useCallback, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, writeBatch, getDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import type { Message } from '../types';

export const useChat = (chatId: string | null, userId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!chatId || !userId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // ... existing logic ...
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          type: data.type || 'text',
          mediaUrl: data.mediaUrl,
          sender: data.senderId === userId ? 'me' : 'them',
          senderId: data.senderId,
          timestamp: data.timestamp?.toDate() || new Date(),
          read: data.read || false,
          delivered: data.delivered || false,
          isDeleted: data.isDeleted || false
        } as Message;
      });
      setMessages(msgs);

      // Auto-mark incoming messages as read/delivered
      const unreadThemMessages = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.senderId !== userId && !data.read;
      });

      if (unreadThemMessages.length > 0) {
        try {
          const batch = writeBatch(db);
          unreadThemMessages.forEach(msgDoc => {
            batch.update(msgDoc.ref, { read: true, delivered: true });
          });
          
          const lastMsgDoc = snapshot.docs[snapshot.docs.length - 1];
          const chatRef = doc(db, 'chats', chatId);
          if (lastMsgDoc && unreadThemMessages.find(m => m.id === lastMsgDoc.id)) {
            batch.update(chatRef, {
              'lastMessage.read': true,
              'lastMessage.delivered': true,
              unreadCount: 0
            });
          } else {
            // Also reset unreadCount if we are reading any messages even if it's not the last one
            batch.update(chatRef, { unreadCount: 0 });
          }
          
          await batch.commit();
        } catch (err) {
          console.error('Error updating read receipts:', err);
        }
      }
    }, (error) => {
      console.error('Messages listener error:', error);
      if (error.code === 'permission-denied') {
        console.error('Permission denied for messages subcollection. Check Firebase Rules.');
      }
    });

    return unsubscribe;
  }, [chatId, userId]);

  const sendMessage = useCallback(async (text: string, type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'link' = 'text', mediaUrl?: string, replyTo?: Message['replyTo']) => {
    if (!chatId || !userId) return;

    // We need userData for senderName and senderAvatar
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : null;

    // Detect if text contains a link and mark it
    let messageType = type;
    if (type === 'text' && /https?:\/\/[^\s]+/.test(text)) {
      messageType = 'link';
    }

    const messageData: any = {
      text,
      type: messageType,
      mediaUrl: mediaUrl || null,
      senderId: userId,
      senderName: userData?.username || 'Unknown',
      senderAvatar: userData?.avatarUrl || null,
      timestamp: serverTimestamp(),
      read: false,
      delivered: false,
      isDeleted: false
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    // Add message to subcollection
    await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);

    // Update last message in chat doc
    const lastMsgText = messageType === 'text' ? text : 
                        messageType === 'link' ? text : `[${messageType}]`;
    await writeBatch(db).update(doc(db, 'chats', chatId), {
      lastMessage: {
        text: lastMsgText,
        senderId: userId,
        senderName: userData?.username || 'Unknown',
        read: false,
        delivered: false,
      },
      updatedAt: serverTimestamp(),
      unreadCount: increment(1)
    }).commit();
  }, [chatId, userId]);

  const sendMediaMessage = useCallback(async (file: File, type: 'image' | 'video' | 'audio' | 'file', caption?: string) => {
    if (!chatId || !userId) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${chatId}/${type === 'file' ? 'docs' : type + 's'}/${fileName}`;
    
    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('media') 
      .upload(filePath, file);

    if (error) {
      console.error('Supabase upload error:', error);
      alert(`Upload failed: ${error.message}.`);
      return;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);
    
    // For files, we might want to include the filename in the text if no caption provided
    const messageText = caption || (type === 'file' ? file.name : "");
    await sendMessage(messageText, type, publicUrl);
  }, [chatId, userId, sendMessage]);


  const editMessage = useCallback(async (messageId: string, newText: string) => {
    if (!chatId || !userId) return;

    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    const msgSnap = await getDoc(msgRef);

    if (!msgSnap.exists()) return;

    const data = msgSnap.data();
    if (data.senderId !== userId) {
      alert("You can only edit your own messages.");
      return;
    }

    const batch = writeBatch(db);
    batch.update(msgRef, {
      text: newText,
      isEdited: true,
      editedAt: serverTimestamp()
    });

    // If this was the last message, update the chat's lastMessage
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists() && chatSnap.data().lastMessage?.text === data.text) {
      batch.update(chatRef, {
        'lastMessage.text': newText
      });
    }

    await batch.commit();
  }, [chatId, userId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!chatId || !userId) return;

    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    const msgSnap = await getDoc(msgRef);

    if (!msgSnap.exists()) return;

    const data = msgSnap.data();
    if (data.senderId !== userId) {
      alert("You can only delete your own messages.");
      return;
    }

    const timestamp = data.timestamp?.toDate() || new Date();
    const now = new Date();
    const diffInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

    if (diffInHours > 12) {
      alert("Messages can only be deleted within 12 hours of sending.");
      return;
    }

    const batch = writeBatch(db);
    batch.update(msgRef, {
      text: "This message was deleted",
      type: 'text',
      mediaUrl: null,
      isDeleted: true
    });

    // If this was the last message, update the chat's lastMessage
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists() && chatSnap.data().lastMessage?.text === data.text) {
      batch.update(chatRef, {
        'lastMessage.text': "This message was deleted",
        'lastMessage.isDeleted': true
      });
    }

    await batch.commit();
  }, [chatId, userId]);

  return { messages, sendMessage, sendMediaMessage, editMessage, deleteMessage };
};


