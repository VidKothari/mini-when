import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';

const RootLayout = () => {
  useEffect(() => {
    SplashScreen.hideAsync(); 
  }, []);

  return (
    <Stack>
      <Stack.Screen name="galleryScreen" options={{ headerShown: false }} />
    </Stack>
  );
};

export default RootLayout;