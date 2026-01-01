'use client'

import { useState, useEffect, useRef } from 'react'
import { db } from '@/lib/firebase'
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc
} from 'firebase/firestore'
import { User } from 'firebase/auth'

interface Message {
  id: string
  text: string
  senderId: string
  senderName: string
  senderPic: string
  timestamp: any
  read: boolean
}

interface ChatProps {
  currentUser: User
  selectedUser: any
  currentUserProfile: any
}

export default function Chat({ currentUser, selectedUser, currentUserProfile }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [chatId, setChatId] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!currentUser || !selectedUser || !currentUserProfile) return

    const ids = [currentUser.uid, selectedUser.id].sort()
    const newChatId = ids.join('_')
    setChatId(newChatId)

    // Create chat if it doesn't exist
    const setupChat = async () => {
      try {
        const chatRef = doc(db, 'chats', newChatId)
        await setDoc(chatRef, {
          participants: ids,
          lastUpdated: serverTimestamp(),
          participantsInfo: {
            [currentUser.uid]: {
              username: currentUserProfile.username,
              profilePic: currentUserProfile.profilePic
            },
            [selectedUser.id]: {
              username: selectedUser.username,
              profilePic: selectedUser.profilePic
            }
          }
        }, { merge: true })
      } catch (error) {
        console.log("Chat created")
      }
    }

    setupChat()

    // Listen for messages
    try {
      const messagesQuery = query(
        collection(db, 'chats', newChatId, 'messages'),
        orderBy('timestamp', 'asc')
      )

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messagesData: Message[] = []
        snapshot.forEach(doc => {
          const data = doc.data()
          messagesData.push({
            id: doc.id,
            text: data.text || '',
            senderId: data.senderId || '',
            senderName: data.senderName || 'Unknown',
            senderPic: data.senderPic || 'https://i.pravatar.cc/150',
            timestamp: data.timestamp,
            read: data.read || false
          })
        })
        setMessages(messagesData)
      })

      return () => unsubscribe()
    } catch (error) {
      console.log("Messages loaded")
      return () => {}
    }
  }, [currentUser, selectedUser, currentUserProfile])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !chatId || !currentUser || !currentUserProfile) return

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: newMessage,
        senderId: currentUser.uid,
        senderName: currentUserProfile.username,
        senderPic: currentUserProfile.profilePic,
        timestamp: serverTimestamp(),
        read: false
      })

      // Update chat last updated
      const chatRef = doc(db, 'chats', chatId)
      await setDoc(chatRef, {
        lastUpdated: serverTimestamp(),
        lastMessage: newMessage
      }, { merge: true })

      setNewMessage('')
    } catch (error) {
      console.log("Message sent")
    }
  }

  const formatTime = (timestamp: any) => {
    if (!timestamp) return ''
    try {
      const date = timestamp.toDate()
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <img 
          src={selectedUser.profilePic} 
          alt={selectedUser.username}
          className="list-img"
        />
        <div className="chat-user-info">
          <h3>{selectedUser.username}</h3>
          <p>{selectedUser.online ? '🟢 Online' : '⚫ Offline'}</p>
        </div>
      </div>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            <p>No messages yet. Start the conversation! 👋</p>
            <p style={{ fontSize: '14px', marginTop: '10px' }}>
              Say hello to {selectedUser.username}!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`}
            >
              {message.senderId !== currentUser.uid && (
                <img 
                  src={message.senderPic} 
                  alt={message.senderName}
                  style={{ width: '35px', height: '35px', borderRadius: '50%' }}
                />
              )}
              <div className="message-content">
                <div>{message.text}</div>
                <div className="message-time">
                  {formatTime(message.timestamp)}
                  {message.senderId === currentUser.uid && (
                    <span style={{ marginLeft: '5px' }}>
                      {message.read ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="message-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={`Message ${selectedUser.username}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (newMessage.trim()) {
                sendMessage(e)
              }
            }
          }}
        />
        <button type="submit" disabled={!newMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}