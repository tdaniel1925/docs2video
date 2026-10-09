import LightOnly from '../../_components/LightOnly'

// Not checked in dark mode yet: this screen stays light (UI round C).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <><LightOnly />{children}</>
}
