import { Resend } from 'resend'
import twilio from 'twilio'

const resend = new Resend(process.env.RESEND_API_KEY!)

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
}

export async function sendDemoReadyEmail(
  to: string,
  companyName: string,
  videoUrl: string,
  signupUrl: string
) {
  try {
    await resend.emails.send({
      from: 'Docs2Video <support@docs2video.com>',
      to,
      subject: `Your ${companyName} demo video is ready`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0;">Your demo is ready</h1>
          </div>
          <p style="font-size: 15px; line-height: 1.6; color: #444;">
            We just finished creating a branded explainer video for <strong>${companyName}</strong>. Take a look — it only takes 60 seconds to watch.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${videoUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Watch Your Demo &rarr;
            </a>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #444;">
            This is a quick demo with a watermark. With full access you get:
          </p>
          <ul style="font-size: 14px; line-height: 1.8; color: #444; padding-left: 20px;">
            <li>32 professional visual styles</li>
            <li>6 natural AI voices</li>
            <li>Your brand colors, logo, and contact info</li>
            <li>HD video with no watermark</li>
            <li>Shareable client page with payments and booking</li>
          </ul>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${signupUrl}" style="display: inline-block; background: #C7E8A8; color: #1a1a1a; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Sign Up Free &rarr;
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="font-size: 11px; color: #999; text-align: center;">
            Docs2Video &mdash; Turn any document into a professional video explainer.<br/>
            27675 Nelson Way, 225, Katy, TX 77494<br/>
            <a href="https://docs2video.com/privacy" style="color: #999;">Privacy Policy</a>
          </p>
        </div>
      `,
    })
    console.log(`[notify] Demo ready email sent to ${to}`)
  } catch (err) {
    console.error(`[notify] Failed to send email to ${to}:`, err)
  }
}

export async function sendDemoReadySms(
  to: string,
  companyName: string,
  demoPageUrl: string
) {
  try {
    const client = getTwilioClient()
    await client.messages.create({
      body: `Your ${companyName} demo video from Docs2Video is ready! Watch it here: ${demoPageUrl}`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    })
    console.log(`[notify] Demo ready SMS sent to ${to}`)
  } catch (err) {
    console.error(`[notify] Failed to send SMS to ${to}:`, err)
  }
}
