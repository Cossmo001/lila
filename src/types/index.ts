export interface Message {
  id: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'link';
  mediaUrl?: string;
  sender: 'me' | 'them';
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  timestamp: Date;
  read: boolean;
  delivered: boolean;
  isDeleted?: boolean;
}

export interface User {
  uid: string;
  username: string;
  photoURL?: string;
  isOnline: boolean;
  lastSeen: Date;
}
export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: Message;
  updatedAt: Date;
  unreadCount?: number;
  isFavorite?: boolean;
  isGroup?: boolean;
  groupMetadata?: {
    name: string;
    photoURL?: string;
    description?: string;
    createdBy: string;
    admins: string[];
  };
  recipient: User;
}
