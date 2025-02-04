import { Redirect } from 'expo-router';
import { auth } from '../services/firebase/index';

export default function Index() {
  return <Redirect href={auth.currentUser ? "/(app)/home" : "/login"} />;
}
