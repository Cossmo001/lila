export interface Message {
  id: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'audio';
  mediaUrl?: string;
  sender: 'me' | 'them';
  timestamp: Date;
  read: boolean;
  delivered: boolean;
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
  recipient: User;
}
