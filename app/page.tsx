import { getBrand } from './_lib/brand-server'
import Text2ArtLanding from './_components/Text2ArtLanding'
import Docs2VideoHome from './_components/marketing/Docs2VideoHome'

// Two storefronts share this route. text2art.app gets its own landing page;
// every other host gets the Docs2Video marketing home. Title, description and
// the OG image come from the root layout's generateMetadata (per brand).
export default async function HomePage() {
  const brand = await getBrand()
  if (brand.id === 'text2art') return <Text2ArtLanding />
  return <Docs2VideoHome />
}
