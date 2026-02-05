"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ReviewsPage() {
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('auth')
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    role: "Agent",
    content: "",
    rating: 5,
  })

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const userData = JSON.parse(userStr)
      setFormData(prev => ({
        ...prev,
        name: userData.name || "",
        role: "Agent",
      }))
    }
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    try {
      const response = await fetch("/api/testimonials")
      if (response.ok) {
        const data = await response.json()
        setReviews(data.testimonials || [])
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.content.trim()) {
      toast({
        title: tCommon('error'),
        description: t('pleaseWriteReview') || "Please write your review",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/testimonials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: tCommon('success'),
          description: t('reviewSubmitted') || "Your review has been submitted successfully.",
        })
        setFormData(prev => ({ ...prev, content: "", rating: 5 }))
        setShowForm(false)
        fetchReviews()
      } else {
        const data = await response.json()
        throw new Error(data.error || t('submitReviewFailed') || "Failed to submit review")
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message || tCommon('error'),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
          />
        ))}
      </div>
    )
  }

  return (
    <DashboardLayout userType="agent">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('reviews')}</h1>
            <p className="text-muted-foreground">{t('shareExperience') || "Share your experience and read what others say"}</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? tCommon('cancel') : (t('writeReview') || "Write a Review")}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{t('writeReview') || "Write Your Review"}</CardTitle>
              <CardDescription>{t('shareExperienceWithRentGuard') || "Share your experience with RentGuard"}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{tAuth('name')}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={tAuth('name')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">{t('yourRole') || "Your Role"}</Label>
                    <Input
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder={t('rolePlaceholderAgent') || "e.g., Agent"}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('rating') || "Rating"}</Label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: star })}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-8 w-8 transition-colors ${
                            star <= formData.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">{t('yourReview') || "Your Review"}</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={t('shareExperiencePlaceholder') || "Share your experience with RentGuard..."}
                    rows={4}
                    required
                  />
                </div>

                <Button type="submit" disabled={submitting}>
                  {submitting ? tCommon('loading') : (t('submitReview') || "Submit Review")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">{tCommon('loading')}</p>
            </CardContent>
          </Card>
        ) : reviews.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Avatar>
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${review.name}`} />
                      <AvatarFallback>{review.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{review.name}</div>
                          <div className="text-sm text-muted-foreground">{review.role}</div>
                        </div>
                        {renderStars(review.rating)}
                      </div>
                      <p className="mt-2 text-sm">{review.content}</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">{t('noReviewsYet') || "No reviews yet. Be the first to share your experience!"}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
