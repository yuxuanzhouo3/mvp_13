import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Join Our Team</h1>
        <p className="text-lg text-muted-foreground mb-8">
          We&apos;re looking for passionate individuals to help us redefine the rental experience.
        </p>
        <div className="space-y-6">
          <div className="border p-6 rounded-lg flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">Senior Frontend Engineer</h2>
              <p className="text-muted-foreground">Remote - Full Time</p>
            </div>
            <Button>Apply Now</Button>
          </div>
          <div className="border p-6 rounded-lg flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">Product Manager</h2>
              <p className="text-muted-foreground">New York - Full Time</p>
            </div>
            <Button>Apply Now</Button>
          </div>
          <div className="border p-6 rounded-lg flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">Customer Support Specialist</h2>
              <p className="text-muted-foreground">Remote - Part Time</p>
            </div>
            <Button>Apply Now</Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
