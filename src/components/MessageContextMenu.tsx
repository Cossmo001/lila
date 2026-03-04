import React, { useEffect, useRef } from 'react';
import { Reply, Edit2, Trash2, CheckSquare } from 'lucide-react';

interface MessageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSelect: () => void;
  isMyMessage: boolean;
  isDeleted?: boolean;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({ 
  x, y, onClose, onReply, onEdit, onDelete, onSelect, isMyMessage, isDeleted 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust position if it goes off screen
  const style: React.CSSProperties = {
    top: y,
    left: x,
    position: 'fixed',
    zIndex: 1000,
  };

  if (isDeleted) return null;

  return (
    <div ref={menuRef} className="message-context-menu" style={style}>
      <button onClick={() => { onReply(); onClose(); }}>
        <Reply size={18} /> <span>Reply</span>
      </button>
      {isMyMessage && onEdit && (
        <button onClick={() => { onEdit(); onClose(); }}>
          <Edit2 size={18} /> <span>Edit</span>
        </button>
      )}
      <button onClick={() => { onSelect(); onClose(); }}>
        <CheckSquare size={18} /> <span>Select</span>
      </button>
      {isMyMessage && onDelete && (
        <button onClick={() => { onDelete(); onClose(); }} className="delete-option">
          <Trash2 size={18} /> <span>Delete</span>
        </button>
      )}
    </div>
  );
};

export default MessageContextMenu;
