import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function SuccessStoriesPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Success Stories</h1>
        <p className="text-lg text-muted-foreground mb-8">
          See how RentGuard has helped landlords and tenants achieve their goals.
        </p>
        <div className="space-y-8">
          <div className="border p-6 rounded-lg">
            <blockquote className="text-xl italic mb-4">"RentGuard made finding a tenant so easy. The screening process gave me peace of mind."</blockquote>
            <cite className="font-semibold">- Sarah J., Landlord</cite>
          </div>
          <div className="border p-6 rounded-lg">
            <blockquote className="text-xl italic mb-4">"I love how secure the deposit protection is. It makes renting much less stressful."</blockquote>
            <cite className="font-semibold">- Michael T., Tenant</cite>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
