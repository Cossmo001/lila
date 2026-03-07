import React, { useState } from 'react';
import { Star, Send, Bug, Sparkles, MessageCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type FeedbackCategory = 'bug' | 'feature' | 'general';

const FeedbackSection: React.FC = () => {
  const { user, userData } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !message.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          username: userData?.username || 'Unknown',
          email: user.email,
          rating,
          category,
          message: message.trim(),
          status: 'pending'
        });
      
      if (error) throw error;
      setIsSuccess(true);
      setRating(0);
      setMessage('');
      setCategory('general');
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      alert("Something went wrong. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="feedback-success fade-in">
        <div className="success-icon-wrapper">
          <CheckCircle size={64} color="var(--accent)" />
        </div>
        <h2>Thank You!</h2>
        <p>Your feedback helps us make Kadi Chat better for everyone. We've received your submission.</p>
        <button className="premium-button" onClick={() => setIsSuccess(false)}>
          Submit More Feedback
        </button>
      </div>
    );
  }

  return (
    <div className="feedback-container fade-in">
      <div className="feedback-header-info">
        <h3>Share your thoughts</h3>
        <p>Your feedback is directly reviewed by our team to improve your experience.</p>
      </div>

      <form onSubmit={handleSubmit} className="feedback-form">
        <div className="rating-section">
          <label>How would you rate your experience?</label>
          <div className="stars-container">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={32}
                className={`star-icon ${star <= (hoverRating || rating) ? 'active' : ''}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                fill={star <= (hoverRating || rating) ? "currentColor" : "none"}
              />
            ))}
          </div>
        </div>

        <div className="category-section">
          <label>Category</label>
          <div className="category-chips">
            <button
              type="button"
              className={`chip ${category === 'bug' ? 'active' : ''}`}
              onClick={() => setCategory('bug')}
            >
              <Bug size={16} /> Bug
            </button>
            <button
              type="button"
              className={`chip ${category === 'feature' ? 'active' : ''}`}
              onClick={() => setCategory('feature')}
            >
              <Sparkles size={16} /> Feature
            </button>
            <button
              type="button"
              className={`chip ${category === 'general' ? 'active' : ''}`}
              onClick={() => setCategory('general')}
            >
              <MessageCircle size={16} /> General
            </button>
          </div>
        </div>

        <div className="message-section">
          <label>Tell us more</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue or suggest a feature..."
            required
            minLength={10}
          />
        </div>

        <button 
          type="submit" 
          className="submit-feedback-btn premium-button" 
          disabled={!rating || !message.trim() || isSubmitting}
        >
          {isSubmitting ? 'Sending...' : (
            <>
              <Send size={18} />
              Send Feedback
            </>
          )}
        </button>
      </form>

      <style>{`
        .feedback-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .feedback-header-info h3 {
          font-size: 1.25rem;
          margin-bottom: 8px;
          color: var(--text-primary);
        }
        .feedback-header-info p {
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.4;
        }
        .feedback-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .rating-section label, .category-section label, .message-section label {
          display: block;
          margin-bottom: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05rem;
        }
        .stars-container {
          display: flex;
          gap: 8px;
        }
        .star-icon {
          cursor: pointer;
          color: var(--text-secondary);
          transition: transform 0.2s, color 0.2s;
        }
        .star-icon.active {
          color: #f1c40f;
          transform: scale(1.1);
        }
        .star-icon:hover {
          transform: scale(1.2);
        }
        .category-chips {
          display: flex;
          gap: 12px;
        }
        .chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 20px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }
        .chip.active {
          background: var(--accent-blue);
          border-color: var(--accent);
          color: white;
        }
        .message-section textarea {
          width: 100%;
          min-height: 120px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          resize: vertical;
          font-family: inherit;
        }
        .message-section textarea:focus {
          outline: none;
          border-color: var(--accent);
        }
        .submit-feedback-btn {
          margin-top: 10px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-weight: 600;
        }
        .feedback-success {
          text-align: center;
          padding: 60px 20px;
        }
        .success-icon-wrapper {
          margin-bottom: 24px;
          display: flex;
          justify-content: center;
        }
        .feedback-success h2 {
          margin-bottom: 12px;
          font-size: 1.5rem;
        }
        .feedback-success p {
          color: var(--text-secondary);
          margin-bottom: 32px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
};

export default FeedbackSection;
