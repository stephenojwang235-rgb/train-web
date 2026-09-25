import SectionHeading from '../../components/common/SectionHeading.jsx'
import Card from '../../components/common/Card.jsx'
import Button from '../../components/common/Button.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Profile() {
  const { user, logout } = useAuth()

  return (
    <div className="container-shell py-14 sm:py-20 max-w-3xl">
      <SectionHeading
        align="left"
        eyebrow="My profile"
        title={user?.name ?? 'Member profile'}
        description="Manage how you appear to your campus fellowship."
      />
      <Card hover={false} className="p-6 sm:p-8 space-y-3 text-sm sm:text-base">
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Campus:</strong> {user?.campus}</p>
        <p><strong>Role:</strong> {user?.role}</p>
        <div className="pt-4">
          <Button variant="dark" onClick={logout}>Logout</Button>
        </div>
      </Card>
    </div>
  )
}
