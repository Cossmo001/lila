import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Message } from '../types';

export const useChat = (chatId: string | null, userId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const fetchMessages = async () => {
    if (!chatId) return;
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(*)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    const formattedMessages = data.map(msg => ({
      id: msg.id,
      text: msg.content,
      type: msg.type || 'text',
      mediaUrl: msg.metadata?.mediaUrl,
      sender: msg.sender_id === userId ? 'me' : 'them',
      senderId: msg.sender_id,
      senderName: msg.sender?.username || 'Unknown',
      senderAvatar: msg.sender?.avatar_url,
      timestamp: new Date(msg.created_at),
      read: msg.is_read || false,
      delivered: true, // Supabase real-time implies delivery
      isDeleted: msg.metadata?.isDeleted || false,
      isEdited: msg.metadata?.isEdited || false,
      editedAt: msg.metadata?.editedAt ? new Date(msg.metadata.editedAt) : undefined,
      replyTo: msg.metadata?.replyTo
    } as Message));

    setMessages(formattedMessages);
  };

  useEffect(() => {
    if (!chatId || !userId) {
      setMessages([]);
      return;
    }

    fetchMessages();

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages', 
        filter: `chat_id=eq.${chatId}` 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          fetchMessages(); // Simplest way to get the joined sender info
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? {
            ...m,
            text: payload.new.content,
            read: payload.new.is_read,
            isEdited: payload.new.metadata?.isEdited,
            isDeleted: payload.new.metadata?.isDeleted
          } : m));
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    // Mark messages as read
    supabase
      .from('messages')
      .update({ is_read: true })
      .eq('chat_id', chatId)
      .neq('sender_id', userId)
      .eq('is_read', false)
      .then(({ error }) => {
        if (error) console.error('Error marking messages as read:', error);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, userId]);

  const sendMessage = useCallback(async (text: string, type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'link' = 'text', mediaUrl?: string, replyTo?: Message['replyTo']) => {
    if (!chatId || !userId) return;

    let messageType = type;
    if (type === 'text' && /https?:\/\/[^\s]+/.test(text)) {
      messageType = 'link';
    }

    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: userId,
        content: text,
        type: messageType,
        metadata: {
          mediaUrl: mediaUrl || null,
          replyTo: replyTo || null,
          isDeleted: false,
          isEdited: false
        }
      });

    if (msgError) {
      console.error('Error sending message:', msgError);
      return;
    }

    // Update chat last message timestamp
    await supabase
      .from('chats')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId);
  }, [chatId, userId]);

  const sendMediaMessage = useCallback(async (file: File, type: 'image' | 'video' | 'audio' | 'file', caption?: string) => {
    if (!chatId || !userId) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${chatId}/${type === 'file' ? 'docs' : type + 's'}/${fileName}`;
    
    const { error } = await supabase.storage
      .from('media') 
      .upload(filePath, file);

    if (error) {
      console.error('Supabase upload error:', error);
      alert(`Upload failed: ${error.message}.`);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);
    
    const messageText = caption || (type === 'file' ? file.name : "");
    await sendMessage(messageText, type, publicUrl);
  }, [chatId, userId, sendMessage]);

  const editMessage = useCallback(async (messageId: string, newText: string) => {
    if (!chatId || !userId) return;

    const { error } = await supabase
      .from('messages')
      .update({
        content: newText,
        metadata: {
          isEdited: true,
          editedAt: new Date().toISOString()
        }
      })
      .eq('id', messageId)
      .eq('sender_id', userId);

    if (error) {
      console.error('Error editing message:', error);
    }
  }, [chatId, userId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!chatId || !userId) return;

    const { error } = await supabase
      .from('messages')
      .update({
        content: "This message was deleted",
        metadata: {
          isDeleted: true
        }
      })
      .eq('id', messageId)
      .eq('sender_id', userId);

    if (error) {
      console.error('Error deleting message:', error);
    }
  }, [chatId, userId]);

  return { messages, sendMessage, sendMediaMessage, editMessage, deleteMessage };
};


