import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/cards'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function CableBoxRemotePage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            CEC Cable Box Control Deprecated
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            CEC-based cable box control has been removed because Spectrum/Charter cable boxes
            do not support CEC control in their firmware.
          </p>
          <p>
            Please use the IR-based cable box control system instead:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Configure cable boxes as IR devices in the admin panel</li>
            <li>Use the IR learning system to capture remote codes</li>
            <li>Access cable box controls through the Bartender Remote</li>
          </ul>
          <div className="pt-4">
            <Link
              href="/admin/ir-devices"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Go to IR Devices Admin
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
