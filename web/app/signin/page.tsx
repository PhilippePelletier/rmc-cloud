// web/app/signin/page.tsx
import { redirect } from 'next/navigation';

export default function LegacySignin() {
  redirect('/sign-in');
}
