import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, Phone, Video } from "lucide-react"

const conversations = [
  {
    id: 1,
    name: "John Smith",
    role: "Landlord",
    lastMessage: "The maintenance request has been scheduled for tomorrow.",
    time: "2 hours ago",
    unread: 2,
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 2,
    name: "Sarah Wilson",
    role: "Tenant",
    lastMessage: "Thank you for the quick response!",
    time: "1 day ago",
    unread: 0,
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 3,
    name: "RentGuard Support",
    role: "Support",
    lastMessage: "Your dispute case has been reviewed.",
    time: "2 days ago",
    unread: 1,
    avatar: "/placeholder.svg?height=40&width=40",
  },
]

const currentMessages = [
  {
    id: 1,
    sender: "John Smith",
    message: "Hi Sarah, I received your maintenance request for the kitchen faucet.",
    time: "10:30 AM",
    isOwn: false,
  },
  {
    id: 2,
    sender: "You",
    message: "Yes, it has been dripping for a few days now. When would be a good time for the repair?",
    time: "10:32 AM",
    isOwn: true,
  },
  {
    id: 3,
    sender: "John Smith",
    message: "I can schedule it for tomorrow between 2-4 PM. Will that work for you?",
    time: "10:35 AM",
    isOwn: false,
  },
  {
    id: 4,
    sender: "You",
    message: "Perfect! I'll be home during that time. Thank you for the quick response.",
    time: "10:37 AM",
    isOwn: true,
  },
]

export function MessageCenter() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Conversations List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Messages</span>
          </CardTitle>
          <CardDescription>Your conversations</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="flex items-center space-x-3 p-4 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={conversation.avatar || "/placeholder.svg"} alt={conversation.name} />
                  <AvatarFallback>
                    {conversation.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">{conversation.name}</div>
                    <div className="text-xs text-muted-foreground">{conversation.time}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground truncate">{conversation.lastMessage}</div>
                    {conversation.unread > 0 && (
                      <Badge className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {conversation.unread}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs mt-1">
                    {conversation.role}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="lg:col-span-2 flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/placeholder.svg?height=40&width=40" alt="John Smith" />
                <AvatarFallback>JS</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">John Smith</div>
                <div className="text-sm text-muted-foreground">Landlord • Online</div>
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

        <CardContent className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
            {currentMessages.map((message) => (
              <div key={message.id} className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <div className="text-sm">{message.message}</div>
                  <div
                    className={`text-xs mt-1 ${message.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {message.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>

        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Input placeholder="Type your message..." className="flex-1" />
            <Button>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
