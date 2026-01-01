'use client'

import { useState } from 'react'

interface ProfileModalProps {
  user: any
  onClose: () => void
  onUpdate: (username: string, profilePic: string) => Promise<void>
}

export default function ProfileModal({ user, onClose, onUpdate }: ProfileModalProps) {
  const [username, setUsername] = useState(user.username)
  const [profilePic, setProfilePic] = useState(user.profilePic)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onUpdate(username, profilePic)
      onClose()
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Profile</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="profile-pic-upload">
            <img 
              src={profilePic} 
              alt="Profile" 
              className="profile-pic-large"
            />
            <div style={{ marginTop: '10px' }}>
              <input
                type="text"
                placeholder="Image URL"
                value={profilePic}
                onChange={(e) => setProfilePic(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Paste image URL (e.g., from imgur.com)
              </p>
            </div>
          </div>
          
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
            />
          </div>
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              style={{ background: '#f5f5f5' }}
            />
          </div>
          
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Updating...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}