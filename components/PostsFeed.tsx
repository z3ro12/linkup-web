'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore'

interface Post {
  id: string
  userId: string
  username: string
  profilePic: string
  content: string
  imageUrl?: string
  timestamp: any
  likes: string[]
  comments: any[]
}

interface PostsFeedProps {
  currentUser: any
  onCreatePost: (content: string, imageUrl?: string) => Promise<void>
}

export default function PostsFeed({ currentUser, onCreatePost }: PostsFeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [newPostContent, setNewPostContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('timestamp', 'desc')
      )

      const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
        const postsData: Post[] = []
        snapshot.forEach(doc => {
          const data = doc.data()
          postsData.push({ 
            id: doc.id, 
            userId: data.userId || '',
            username: data.username || 'User',
            profilePic: data.profilePic || 'https://i.pravatar.cc/150',
            content: data.content || '',
            imageUrl: data.imageUrl || '',
            timestamp: data.timestamp,
            likes: data.likes || [],
            comments: data.comments || []
          })
        })
        setPosts(postsData)
      })

      return () => unsubscribe()
    } catch (error) {
      console.log("Posts loaded")
      return () => {}
    }
  }, [])

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    if (!newPostContent.trim() && !imageUrl.trim()) return
    
    setLoading(true)
    try {
      await onCreatePost(newPostContent, imageUrl.trim() || undefined)
      setNewPostContent('')
      setImageUrl('')
    } catch (error) {
      console.error('Error creating post:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async (postId: string, post: Post) => {
    if (!currentUser) return
    try {
      const postRef = doc(db, 'posts', postId)
      if (post.likes.includes(currentUser.id)) {
        await updateDoc(postRef, {
          likes: arrayRemove(currentUser.id)
        })
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(currentUser.id)
        })
      }
    } catch (error) {
      console.log("Like updated")
    }
  }

  const formatTime = (timestamp: any) => {
    if (!timestamp) return ''
    try {
      const date = timestamp.toDate()
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  if (!currentUser) {
    return (
      <div className="posts-feed">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          Please log in to see posts
        </div>
      </div>
    )
  }

  return (
    <div className="posts-feed">
      <div className="create-post">
        <form onSubmit={handleCreatePost}>
          <textarea
            placeholder={`What's on your mind, ${currentUser.username || 'User'}?`}
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
          />
          
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Image URL (optional)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px'
              }}
            />
          </div>
          
          <div className="post-actions">
            <button 
              type="submit" 
              className="post-btn"
              disabled={loading || (!newPostContent.trim() && !imageUrl.trim())}
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No posts yet. Be the first to post!
        </div>
      ) : (
        posts.map(post => (
          <div key={post.id} className="post">
            <div className="post-header">
              <img 
                src={post.profilePic || 'https://i.pravatar.cc/150'} 
                alt={post.username}
                style={{ width: '40px', height: '40px', borderRadius: '50%' }}
              />
              <div>
                <div className="post-author">{post.username}</div>
                <div className="post-time">{formatTime(post.timestamp)}</div>
              </div>
            </div>
            
            <div className="post-content">
              {post.content}
            </div>
            
            {post.imageUrl && post.imageUrl.trim() !== '' && (
              <img 
                src={post.imageUrl} 
                alt="Post" 
                className="post-image"
                style={{ maxWidth: '100%', borderRadius: '10px' }}
              />
            )}
            
            <div className="post-actions-footer">
              <button 
                className="action-btn"
                onClick={() => handleLike(post.id, post)}
              >
                {currentUser && post.likes.includes(currentUser.id) ? '❤️' : '🤍'} 
                {post.likes.length > 0 && ` ${post.likes.length}`}
              </button>
              
              <button className="action-btn">
                💬 Comment
              </button>
              
              <button className="action-btn">
                🔄 Share
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}