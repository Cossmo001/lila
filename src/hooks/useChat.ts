import { useState, useCallback, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, writeBatch } from 'firebase/firestore';
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
          timestamp: data.timestamp?.toDate() || new Date(),
          read: data.read || false,
          delivered: data.delivered || false,
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
          if (lastMsgDoc && unreadThemMessages.find(m => m.id === lastMsgDoc.id)) {
            const chatRef = doc(db, 'chats', chatId);
            batch.update(chatRef, {
              'lastMessage.read': true,
              'lastMessage.delivered': true
            });
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

  const sendMessage = useCallback(async (text: string, type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'link' = 'text', mediaUrl?: string) => {
    if (!chatId || !userId) return;

    // Detect if text contains a link and mark it
    let messageType = type;
    if (type === 'text' && /https?:\/\/[^\s]+/.test(text)) {
      messageType = 'link';
    }

    const messageData = {
      text,
      type: messageType,
      mediaUrl: mediaUrl || null,
      senderId: userId,
      timestamp: serverTimestamp(),
      read: false,
      delivered: false,
    };

    // Add message to subcollection
    await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);

    // Update last message in chat doc
    const lastMsgText = messageType === 'text' ? text : 
                        messageType === 'link' ? text : `[${messageType}]`;
    await writeBatch(db).update(doc(db, 'chats', chatId), {
      lastMessage: {
        text: lastMsgText,
        senderId: userId,
        read: false,
        delivered: false,
      },
      updatedAt: serverTimestamp()
    }).commit();
  }, [chatId, userId]);

  const sendMediaMessage = useCallback(async (file: File, type: 'image' | 'video' | 'audio' | 'file') => {
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
    
    // For files, we might want to include the filename in the text
    const messageText = type === 'file' ? file.name : "";
    await sendMessage(messageText, type, publicUrl);
  }, [chatId, userId, sendMessage]);


  return { messages, sendMessage, sendMediaMessage };
};


