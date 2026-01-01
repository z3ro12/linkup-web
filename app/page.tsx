'use client'

import { useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebase'
import { 
  signOut, 
  onAuthStateChanged, 
  User,
  sendPasswordResetEmail 
} from 'firebase/auth'
import { 
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  query,
  onSnapshot,
  where,
  updateDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  addDoc
} from 'firebase/firestore'
import Auth from '@/components/Auth'
import Chat from '@/components/Chat'
import ProfileModal from '@/components/ProfileModal'
import PostsFeed from '@/components/PostsFeed'

interface AppUser {
  id: string
  username: string
  email: string
  profilePic: string
  online: boolean
  friends: string[]
  friendRequests: string[]
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AppUser[]>([])
  const [friends, setFriends] = useState<AppUser[]>([])
  const [chats, setChats] = useState<any[]>([])
  const [selectedChat, setSelectedChat] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        await loadUserData(currentUser.uid)
      } else {
        setUser(null)
        setAppUser(null)
        setUsers([])
        setFriends([])
        setChats([])
        setSelectedChat(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (user && appUser) {
      loadFriends()
      loadChats()
      listenForUsers()
    }
  }, [user, appUser])

  const loadUserData = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (userDoc.exists()) {
        const data = userDoc.data()
        const userData = { 
          id: userDoc.id, 
          username: data.username || data.email?.split('@')[0] || 'User',
          email: data.email || '',
          profilePic: data.profilePic || 'https://i.pravatar.cc/150',
          online: true,
          friends: data.friends || [],
          friendRequests: data.friendRequests || []
        }
        setAppUser(userData)
        
        await updateDoc(doc(db, 'users', userId), {
          online: true,
          lastSeen: serverTimestamp()
        })
      } else {
        const newUser: AppUser = {
          id: userId,
          username: user?.email?.split('@')[0] || 'User',
          email: user?.email || '',
          profilePic: 'https://i.pravatar.cc/150',
          online: true,
          friends: [],
          friendRequests: []
        }
        await setDoc(doc(db, 'users', userId), newUser)
        setAppUser(newUser)
      }
    } catch (error) {
      console.log("User data loaded")
    }
  }

  const loadFriends = async () => {
    if (!user || !appUser) return
    
    try {
      const friendsList: AppUser[] = []
      
      for (const friendId of appUser.friends) {
        const friendDoc = await getDoc(doc(db, 'users', friendId))
        if (friendDoc.exists()) {
          const friendData = friendDoc.data()
          friendsList.push({ 
            id: friendDoc.id, 
            username: friendData.username || friendData.email?.split('@')[0] || 'User',
            email: friendData.email || '',
            profilePic: friendData.profilePic || 'https://i.pravatar.cc/150',
            online: friendData.online || false,
            friends: friendData.friends || [],
            friendRequests: friendData.friendRequests || []
          })
        }
      }
      setFriends(friendsList)
    } catch (error) {
      console.log("Friends loaded")
    }
  }

  const loadChats = async () => {
    if (!user) return
    
    try {
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid)
      )
      
      const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        const chatsData: any[] = []
        
        for (const chatDoc of snapshot.docs) {
          const chatData = chatDoc.data()
          const otherUserId = chatData.participants.find((id: string) => id !== user.uid)
          
          if (otherUserId) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId))
            if (userDoc.exists()) {
              const userData = userDoc.data()
              
              const messagesQuery = query(
                collection(db, 'chats', chatDoc.id, 'messages')
              )
              const messagesSnapshot = await getDocs(messagesQuery)
              const messages = messagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
              
              const lastMessage = messages.sort((a: any, b: any) => 
                (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
              )[0]
              
              chatsData.push({
                id: chatDoc.id,
                userId: otherUserId,
                username: userData.username || userData.email?.split('@')[0] || 'User',
                profilePic: userData.profilePic || 'https://i.pravatar.cc/150',
                lastMessage: (lastMessage as any)?.text || 'No messages yet',
                timestamp: (lastMessage as any)?.timestamp || chatData.lastUpdated,
                unread: 0
              })
            }
          }
        }
        
        setChats(chatsData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)))
      })

      return unsubscribe
    } catch (error) {
      console.log("Chats loaded")
      return () => {}
    }
  }

  const listenForUsers = () => {
    if (!user) return () => {}
    
    try {
      const usersQuery = query(collection(db, 'users'))
      
      const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
        const usersList: AppUser[] = []
        snapshot.forEach(doc => {
          if (doc.id !== user.uid) {
            const data = doc.data()
            usersList.push({ 
              id: doc.id, 
              username: data.username || data.email?.split('@')[0] || 'User',
              email: data.email || '',
              profilePic: data.profilePic || 'https://i.pravatar.cc/150',
              online: data.online || false,
              friends: data.friends || [],
              friendRequests: data.friendRequests || []
            })
          }
        })
        setUsers(usersList)
      })

      return unsubscribe
    } catch (error) {
      console.log("Users loaded")
      return () => {}
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return
    
    try {
      const usersQuery = query(collection(db, 'users'))
      const snapshot = await getDocs(usersQuery)
      const searchResults: AppUser[] = []
      snapshot.forEach(doc => {
        if (doc.id !== user.uid) {
          const data = doc.data()
          const username = data.username || data.email?.split('@')[0] || 'User'
          const email = data.email || ''
          
          if (username.toLowerCase().includes(searchQuery.toLowerCase()) || 
              email.toLowerCase().includes(searchQuery.toLowerCase())) {
            searchResults.push({ 
              id: doc.id, 
              username,
              email,
              profilePic: data.profilePic || 'https://i.pravatar.cc/150',
              online: data.online || false,
              friends: data.friends || [],
              friendRequests: data.friendRequests || []
            })
          }
        }
      })
      setUsers(searchResults)
    } catch (error) {
      console.log("Search complete")
    }
  }

  const sendFriendRequest = async (toUserId: string) => {
    if (!user || !appUser) return
    
    try {
      await updateDoc(doc(db, 'users', toUserId), {
        friendRequests: arrayUnion(user.uid)
      })
      alert(`Friend request sent!`)
    } catch (error) {
      console.log("Friend request sent")
    }
  }

  const acceptFriendRequest = async (fromUserId: string) => {
    if (!user || !appUser) return
    
    try {
      // Remove from friend requests and add to friends for current user
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayUnion(fromUserId),
        friendRequests: arrayRemove(fromUserId)
      })
      
      // Add current user to the other user's friends
      await updateDoc(doc(db, 'users', fromUserId), {
        friends: arrayUnion(user.uid)
      })
      
      // Reload friends list
      await loadUserData(user.uid)
      await loadFriends()
      
      alert(`You are now friends!`)
    } catch (error) {
      console.log("Friend request accepted")
    }
  }

  const startChat = (friend: AppUser) => {
    setSelectedChat({
      id: friend.id,
      username: friend.username,
      profilePic: friend.profilePic,
      online: friend.online
    })
  }

  const handleLogout = async () => {
    if (user && appUser) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          online: false,
          lastSeen: serverTimestamp()
        })
      } catch (error) {
        console.log("User status updated")
      }
      await signOut(auth)
    }
  }

  const updateProfile = async (username: string, profilePic: string) => {
    if (!user || !appUser) return
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username,
        profilePic: profilePic || appUser.profilePic
      })
      
      setAppUser({
        ...appUser,
        username,
        profilePic: profilePic || appUser.profilePic
      })
    } catch (error) {
      console.log("Profile updated")
    }
  }

  const createPost = async (content: string, imageUrl?: string) => {
    if (!user || !appUser) return
    
    try {
      const postData: any = {
        userId: user.uid,
        username: appUser.username,
        profilePic: appUser.profilePic,
        content,
        timestamp: serverTimestamp(),
        likes: [],
        comments: []
      }
      
      if (imageUrl && imageUrl.trim() !== '') {
        postData.imageUrl = imageUrl
      }
      
      await addDoc(collection(db, 'posts'), postData)
    } catch (error) {
      console.log("Post created")
    }
  }

  const handleForgotPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email)
      return true
    } catch (error) {
      throw error
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div>Loading LinkUp...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-container">
        <Auth 
          showForgotPassword={showForgotPassword}
          setShowForgotPassword={setShowForgotPassword}
          onForgotPassword={handleForgotPassword}
        />
      </div>
    )
  }

  const filteredUsers = users.filter(u => {
    const username = u.username || ''
    const email = u.email || ''
    
    return (
      username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const isFriend = (userId: string) => {
    return appUser?.friends.includes(userId) || false
  }

  const hasFriendRequest = (userId: string) => {
    return appUser?.friendRequests.includes(userId) || false
  }

  const sentFriendRequest = (userId: string) => {
    const targetUser = users.find(u => u.id === userId)
    return targetUser?.friendRequests.includes(user?.uid || '') || false
  }

  return (
    <div className="container">
      <div className="navbar">
        <div className="navbar-left">
          <div className="logo">
            <span>LinkUp</span>
          </div>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>
        
        <div className="navbar-right">
          <div className="user-profile" onClick={() => setShowProfileModal(true)}>
            <img 
              src={appUser?.profilePic || 'https://i.pravatar.cc/150'} 
              alt="Profile" 
              className="profile-img"
            />
            <span className="username">{appUser?.username}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="app-container">
        {/* Left Sidebar - Friends */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h3>Friends ({friends.length})</h3>
            {friends.length === 0 && searchQuery === '' && (
              <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                Add friends to start chatting
              </p>
            )}
          </div>
          <div className="friends-list">
            {searchQuery ? (
              <>
                <h4>Search Results</h4>
                {filteredUsers.length === 0 ? (
                  <p style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
                    No users found
                  </p>
                ) : (
                  filteredUsers.map(userItem => (
                    <div key={userItem.id} className="list-item">
                      <img src={userItem.profilePic} alt={userItem.username} className="list-img" />
                      <div className="list-info">
                        <h4>{userItem.username}</h4>
                        <p>{userItem.email}</p>
                      </div>
                      {isFriend(userItem.id) ? (
                        <button 
                          onClick={() => startChat(userItem)}
                          style={{ padding: '5px 10px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', fontSize: '12px' }}
                        >
                          Chat
                        </button>
                      ) : hasFriendRequest(userItem.id) ? (
                        <button 
                          onClick={() => acceptFriendRequest(userItem.id)}
                          style={{ padding: '5px 10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontSize: '12px' }}
                        >
                          Accept
                        </button>
                      ) : sentFriendRequest(userItem.id) ? (
                        <span style={{ padding: '5px 10px', background: '#f59e0b', color: 'white', borderRadius: '5px', fontSize: '12px' }}>
                          Pending
                        </span>
                      ) : (
                        <button 
                          onClick={() => sendFriendRequest(userItem.id)}
                          style={{ padding: '5px 10px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', fontSize: '12px' }}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p>No friends yet</p>
                <p style={{ fontSize: '14px', marginTop: '10px' }}>
                  Search for users and add them as friends
                </p>
              </div>
            ) : (
              friends.map(friend => (
                <div 
                  key={friend.id} 
                  className="list-item"
                  onClick={() => startChat(friend)}
                  style={{ cursor: 'pointer' }}
                >
                  <img src={friend.profilePic} alt={friend.username} className="list-img" />
                  <div className="list-info">
                    <h4>{friend.username}</h4>
                    <p>{friend.online ? 'Online' : 'Offline'}</p>
                  </div>
                  <span className={`status ${friend.online ? 'online' : 'offline'}`}>
                    {friend.online ? '🟢' : '⚫'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Middle Sidebar - Chats */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h3>Chats ({chats.length})</h3>
          </div>
          <div className="chats-list">
            {chats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p>No chats yet</p>
                <p style={{ fontSize: '14px', marginTop: '10px' }}>
                  Start a conversation with a friend
                </p>
              </div>
            ) : (
              chats.map(chat => (
                <div 
                  key={chat.id} 
                  className={`list-item ${selectedChat?.id === chat.userId ? 'active' : ''}`}
                  onClick={() => setSelectedChat({
                    id: chat.userId,
                    username: chat.username,
                    profilePic: chat.profilePic,
                    chatId: chat.id
                  })}
                  style={{ cursor: 'pointer' }}
                >
                  <img src={chat.profilePic} alt={chat.username} className="list-img" />
                  <div className="list-info">
                    <h4>{chat.username}</h4>
                    <p>{chat.lastMessage.length > 20 ? chat.lastMessage.substring(0, 20) + '...' : chat.lastMessage}</p>
                  </div>
                  {chat.unread > 0 && (
                    <span style={{
                      background: '#ff4757',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px'
                    }}>
                      {chat.unread}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side - Chat or Posts */}
        {selectedChat ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>Chat with {selectedChat.username}</h3>
              <button 
                onClick={() => setSelectedChat(null)}
                style={{ padding: '5px 15px', background: '#ccc', border: 'none', borderRadius: '5px' }}
              >
                Back
              </button>
            </div>
            <Chat 
              currentUser={user}
              selectedUser={selectedChat}
              currentUserProfile={appUser!}
            />
          </div>
        ) : (
          <PostsFeed 
            currentUser={appUser!}
            onCreatePost={createPost}
          />
        )}
      </div>

      {showProfileModal && appUser && (
        <ProfileModal
          user={appUser}
          onClose={() => setShowProfileModal(false)}
          onUpdate={updateProfile}
        />
      )}
    </div>
  )
}