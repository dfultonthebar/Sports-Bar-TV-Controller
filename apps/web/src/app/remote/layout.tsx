import UpdateAvailableBanner from '@/components/UpdateAvailableBanner'

// Disable caching for bartender remote - layout data is dynamic and changes frequently
export const revalidate = 0

export default function RemoteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <UpdateAvailableBanner />
      {children}
    </>
  )
}
