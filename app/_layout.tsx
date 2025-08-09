import { Stack } from "expo-router"; // stack of pages

const RootLayout = () => {
  return <Stack 
          screenOptions={{
            headerShown: false
          }}
  />;
}

export default RootLayout;
