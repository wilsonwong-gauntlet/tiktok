import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'expo-router';

export default function Home() {
  const router = useRouter();
  const auth = getAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome to ReelAI!</Text>
      <Text style={styles.email}>{auth.currentUser?.email}</Text>
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  email: {
    fontSize: 16,
    color: '#888',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
    width: 200,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
}); 