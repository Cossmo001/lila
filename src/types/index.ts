export interface Message {
  id: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'link' | 'call';
  mediaUrl?: string;
  sender: 'me' | 'them';
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  timestamp: Date;
  read: boolean;
  delivered: boolean;
  isDeleted: boolean;
  isEdited?: boolean;
  editedAt?: Date;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
}

export interface User {
  id: string;
  username: string;
  avatar_url?: string;
  status: 'online' | 'offline';
  last_seen: Date;
}
export interface Chat {
  id: string;
  participants: string[];
  last_message?: any; // Message type needs careful nesting
  updated_at: Date;
  unread_count?: number;
  is_favorite?: boolean;
  is_group?: boolean;
  name?: string;
  icon_url?: string;
  recipient?: User;
}
