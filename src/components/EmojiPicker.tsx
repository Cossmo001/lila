import React, { useState, useEffect, useRef } from 'react';
import { Search, Globe, Star } from 'lucide-react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const UNICODE_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', 
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤔',
  '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦',
  '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
  '🤢', '🤮', '🤧', '🤨', '🧐', '🤫', '🫠', '🫣', '🫡', '🫥'
];

const CUSTOM_EMOJIS = [
  '✨', '💎', '🎨', '🚀', '🔥', '⚡', '🌈', '🌙', '⭐', '🎈',
  '💎', '💠', '🛡️', '⚔️', '🔮', '🧬', '🧪', '🔭', '🛰️', '🛸',
  '🍎', '🍋', '🍒', '🍓', '🥑', '🌮', '🍣', '🍦', '🍕', '🍔',
  '🎮', '🎸', '📷', '📽️', '🎬', '🎹', '🎧', '🎤', '🎪', '🎭',
  '🦁', '🐲', '🦄', '🦅', '🦋', '🐳', '🐾', '🌍', '🌋', '🌊'
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect }) => {
  const [activeTab, setActiveTab] = useState<'standard' | 'custom'>('standard');
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const filteredEmojis = (activeTab === 'standard' ? UNICODE_EMOJIS : CUSTOM_EMOJIS)
    .filter(emoji => !searchQuery || emoji.includes(searchQuery));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        // We don't close here because ChatInput handles the toggle state
        // but it's good for accessibility and clicking outside the entire input area
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="emoji-picker-premium" ref={pickerRef}>
      <div className="picker-header">
        <div className="search-container-mini">
          <Search size={14} />
          <input 
            type="text" 
            placeholder="Search emojis..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="picker-tabs">
        <button 
          className={`tab-btn ${activeTab === 'standard' ? 'active' : ''}`}
          onClick={() => setActiveTab('standard')}
        >
          <Globe size={18} />
          <span>Standard</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom')}
        >
          <Star size={18} />
          <span>Lila</span>
        </button>
      </div>

      <div className="emoji-grid">
        {filteredEmojis.length > 0 ? (
          filteredEmojis.map((emoji, index) => (
            <button 
              key={index} 
              className="emoji-item"
              onClick={() => onEmojiSelect(emoji)}
            >
              {emoji}
            </button>
          ))
        ) : (
          <div className="no-results">No emojis found</div>
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;
