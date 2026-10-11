export const metadata = { title: "Privacy Policy · Shorts Studio" };

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl space-y-4 text-sm leading-relaxed text-zinc-300">
      <h1 className="text-2xl font-semibold text-white">Privacy Policy</h1>
      <p className="text-zinc-500">Last updated: September 30, 2026</p>
      <p>
        Shorts Studio is a personal tool used only by its owner. When you connect a TikTok, YouTube or Instagram account
        it stores the access token and your display name locally on the owner&apos;s computer, so it can upload videos
        you choose to post. Nothing is sold or shared with third parties.
      </p>
      <p>
        Data requested from TikTok: basic profile info (user.info.basic) and permission to upload and publish videos
        (video.upload, video.publish). It is used only to post videos to your own account.
      </p>
      <p>
        Disconnecting an account on the Accounts page deletes its stored token. You can also revoke access in the
        platform&apos;s app settings at any time.
      </p>
    </article>
  );
}
