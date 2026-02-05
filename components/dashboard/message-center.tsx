"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, Phone, Video, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Message {
  id: string
  senderId: string
  receiverId: string
  content: string
  createdAt: string
  sender?: { id: string; name: string; email: string }
  receiver?: { id: string; name: string; email: string }
}

interface Conversation {
  id: string
  name: string
  email: string
  avatar?: string
  role?: string
  lastMessage: string
  time: Date | string
  unread: number
  property?: any
}

interface CurrentUser {
  id: string
  name: string
  email: string
  userType: string
}

export function MessageCenter() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tMessage = useTranslations('message')
  const tCommon = useTranslations('common')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  
  const isFetchingRef = useRef(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  // Initialize current user
  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        console.log("Current user loaded:", user)
        setCurrentUser(user)
      } catch (e) {
        console.error("Failed to parse user:", e)
      }
    }
    fetchConversations()
  }, [])

  // Handle URL params for auto-selecting conversation
  useEffect(() => {
    const userId = searchParams.get('userId')
    if (userId && !loading && conversations.length > 0) {
      const conv = conversations.find(c => c.id === userId)
      if (conv) {
        handleSelectConversation(conv)
      } else {
        fetchUserAndCreateConversation(userId)
      }
    }
  }, [searchParams, loading, conversations])

  // Polling for new messages and conversations - without auto scroll
  useEffect(() => {
    if (!selectedConversation?.id) return
    
    const interval = setInterval(() => {
      if (!isFetchingRef.current && !sending) {
        loadMessages(selectedConversation.id, false)
        fetchConversationsQuiet() // Refresh conversations to update lastMessage
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [selectedConversation?.id, sending])

  // Fetch conversations quietly (without loading state)
  const fetchConversationsQuiet = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const [conversationsRes, contactsRes] = await Promise.all([
        fetch("/api/messages/conversations", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/messages/contacts", {
          headers: { Authorization: `Bearer ${token}` },
        })
      ])

      let allConversations: Conversation[] = []
      const conversationIds = new Set<string>()

      if (conversationsRes.ok) {
        const data = await conversationsRes.json()
        allConversations = (data.conversations || []).map((c: any) => {
          conversationIds.add(c.id)
          return {
            ...c,
            lastMessage: c.lastMessage || ""
          }
        })
      }

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json()
        const contacts = contactsData.contacts || []
        
        contacts.forEach((contact: any) => {
          if (!conversationIds.has(contact.id)) {
            allConversations.push({
              id: contact.id,
              name: contact.name || contact.email,
              email: contact.email,
              avatar: contact.avatar,
              role: contact.role,
              lastMessage: contact.lastMessage || "",
              time: contact.time || new Date(),
              unread: contact.unread || 0,
              property: contact.property
            })
          }
        })
      }

      setConversations(allConversations)
    } catch (error) {
      console.error("Failed to fetch conversations:", error)
    }
  }

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        console.log("No auth token found")
        setLoading(false)
        return
      }

      console.log("Fetching conversations...")

      const [conversationsRes, contactsRes] = await Promise.all([
        fetch("/api/messages/conversations", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/messages/contacts", {
          headers: { Authorization: `Bearer ${token}` },
        })
      ])

      let allConversations: Conversation[] = []
      const conversationIds = new Set<string>()

      if (conversationsRes.ok) {
        const data = await conversationsRes.json()
        console.log("Conversations data:", data)
        allConversations = (data.conversations || []).map((c: any) => {
          conversationIds.add(c.id)
          return {
            ...c,
            lastMessage: c.lastMessage || ""
          }
        })
      } else {
        console.error("Conversations fetch failed:", await conversationsRes.text())
      }

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json()
        console.log("Contacts data:", contactsData)
        const contacts = contactsData.contacts || []
        
        contacts.forEach((contact: any) => {
          if (!conversationIds.has(contact.id)) {
            allConversations.push({
              id: contact.id,
              name: contact.name || contact.email,
              email: contact.email,
              avatar: contact.avatar,
              role: contact.role,
              lastMessage: contact.lastMessage || "",
              time: contact.time || new Date(),
              unread: contact.unread || 0,
              property: contact.property
            })
          }
        })
      } else {
        console.error("Contacts fetch failed:", await contactsRes.text())
      }

      console.log("Total conversations:", allConversations.length)
      setConversations(allConversations)
      
      // Auto-select first conversation if none selected
      if (allConversations.length > 0 && !selectedConversation) {
        handleSelectConversation(allConversations[0])
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = useCallback(async (partnerId: string, scrollAfterLoad = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        console.log("No token for loading messages")
        return
      }

      console.log("Loading messages for partner:", partnerId)

      const response = await fetch(`/api/messages?partnerId=${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        const fetchedMessages = data.messages || []
        console.log("Loaded messages:", fetchedMessages.length)
        setMessages(fetchedMessages)
        
        // Only scroll to bottom when explicitly requested (initial load or after sending)
        if (scrollAfterLoad) {
          setTimeout(scrollToBottom, 100)
        }
      } else {
        console.error("Load messages failed:", await response.text())
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error)
    } finally {
      isFetchingRef.current = false
    }
  }, [scrollToBottom])

  const handleSelectConversation = (conversation: Conversation) => {
    console.log("Selected conversation:", conversation.id, conversation.name)
    setSelectedConversation(conversation)
    setMessages([])
    loadMessages(conversation.id, true) // Scroll to bottom on initial load
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sending) return
    
    if (!currentUser?.id) {
      toast({
        title: tCommon('error'),
        description: tMessage('noMessages') || "Please login to send messages",
        variant: "destructive",
      })
      return
    }

    console.log("Sending message from", currentUser.id, "to", selectedConversation.id)
    
    setSending(true)
    const messageToSend = messageInput.trim()
    const tempId = `temp-${Date.now()}`
    
    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      senderId: currentUser.id,
      receiverId: selectedConversation.id,
      content: messageToSend,
      createdAt: new Date().toISOString(),
    }
    
    // Add to messages immediately
    setMessages(prev => [...prev, optimisticMessage])
    setMessageInput("")
    
    // Scroll to bottom after sending
    setTimeout(scrollToBottom, 100)

    try {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        throw new Error("Not authenticated")
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId: selectedConversation.id,
          content: messageToSend,
        }),
      })

      const data = await response.json()
      console.log("Send message response:", data)
      
      if (response.ok && data.message) {
        // Replace optimistic message with real one
        setMessages(prev => prev.map(msg => 
          msg.id === tempId ? data.message : msg
        ))
        
        // Update conversation last message
        setConversations(prev => prev.map(conv => 
          conv.id === selectedConversation.id 
            ? { ...conv, lastMessage: messageToSend, time: new Date() }
            : conv
        ))
        
        toast({
          title: tCommon('success'),
          description: tMessage('send') || "Message sent successfully",
        })
      } else {
        throw new Error(data.error || "Failed to send message")
      }
    } catch (error: any) {
      console.error("Send message error:", error)
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId))
      setMessageInput(messageToSend)
      toast({
        title: tCommon('error'),
        description: error.message || tCommon('error'),
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchConversations()
    if (selectedConversation) {
      await loadMessages(selectedConversation.id, false) // Don't scroll on manual refresh
    }
    setRefreshing(false)
    toast({
      title: tCommon('success'),
      description: tMessage('title') || "Messages updated",
    })
  }

  const fetchUserAndCreateConversation = async (userId: string) => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch(`/api/auth/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const user = await response.json()
        const newConv: Conversation = {
          id: userId,
          name: user.name || user.email,
          email: user.email,
          avatar: user.avatar,
          role: user.userType || "USER",
          lastMessage: "",
          time: new Date(),
          unread: 0,
          property: null,
        }
        
        setConversations(prev => {
          if (prev.find(c => c.id === userId)) return prev
          return [newConv, ...prev]
        })
        handleSelectConversation(newConv)
      }
    } catch (error) {
      console.error("Failed to fetch user:", error)
    }
  }

  const formatTime = (date: string | Date | null | undefined) => {
    if (!date) return ""
    const d = new Date(date)
    if (isNaN(d.getTime())) return ""
    
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Conversations List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>{t('messages')}</span>
            </CardTitle>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>
            {currentUser ? (t('loggedInAs') || `Logged in as: ${currentUser.name}`) : (t('yourConversations') || 'Your conversations')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">{tCommon('loading')}</div>
          ) : conversations.length > 0 ? (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`flex items-center space-x-3 p-4 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 ${
                    selectedConversation?.id === conversation.id ? "bg-muted" : ""
                  }`}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={conversation.avatar || "/placeholder-user.jpg"} alt={conversation.name} />
                    <AvatarFallback>
                      {conversation.name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{conversation.name}</div>
                      <div className="text-xs text-muted-foreground">{formatTime(conversation.time)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground truncate">
                        {conversation.lastMessage || (t('startConversation') || "Start a conversation")}
                      </div>
                      {conversation.unread > 0 && (
                        <Badge className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                          {conversation.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">{t('noConversationsYet')}</div>
          )}
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="lg:col-span-2 flex flex-col h-[600px]">
        {selectedConversation ? (
          <>
            <CardHeader className="border-b py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConversation.avatar || "/placeholder-user.jpg"} alt={selectedConversation.name} />
                    <AvatarFallback>
                      {selectedConversation.name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{selectedConversation.name}</div>
                    <div className="text-sm text-muted-foreground">{selectedConversation.email}</div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Video className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Messages container - fixed height with scroll */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 p-4 overflow-y-auto"
            >
              {messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isOwn = currentUser && message.senderId === currentUser.id
                    return (
                      <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <div className="text-sm">{message.content}</div>
                          <div
                            className={`text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                          >
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">{t('noMessagesYet') || "No messages yet. Start the conversation!"}</div>
              )}
            </div>

            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Input 
                  placeholder={t('typeMessage') || "Type your message..."} 
                  className="flex-1" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !sending) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={sending}
                />
                <Button onClick={handleSendMessage} disabled={sending || !messageInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {t('selectConversation') || "Select a conversation to start messaging"}
          </div>
        )}
      </Card>
    </div>
  )
}
