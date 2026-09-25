import SectionHeading from '../../components/common/SectionHeading.jsx'
import Card from '../../components/common/Card.jsx'
import PlanAVisitForm from '../../components/features/PlanAVisitForm.jsx'
import { contactInfo } from '../../data/site.js'

export default function Contact() {
  return (
    <div className="container-shell py-14 sm:py-20">
      <SectionHeading
        eyebrow="Say hello"
        title="Plan your visit"
        description="New in Nairobi or new to faith? Tell us where you study — a student leader will reach out this week."
      />
      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl mx-auto">
        <Card hover={false} className="p-6 sm:p-8">
          <PlanAVisitForm />
        </Card>

        <div className="space-y-4">
          <Card hover={false} className="p-6 sm:p-7">
            <h3 className="font-bold text-lg text-slate-900">Visit us</h3>
            <p className="mt-2 text-sm text-slate-600">{contactInfo.address}</p>
            <p className="mt-1 text-sm text-slate-600">{contactInfo.serviceTime}</p>
          </Card>
          <Card hover={false} className="p-6 sm:p-7">
            <h3 className="font-bold text-lg text-slate-900">Talk to us</h3>
            <p className="mt-2 text-sm text-slate-600">{contactInfo.email}</p>
            <p className="mt-1 text-sm text-slate-600">{contactInfo.phone}</p>
            <p className="mt-3 text-sm text-slate-500">WhatsApp available Mon–Sat, 8 AM – 8 PM</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
