import { StyleSheet, Text, View } from "react-native";

const HomeScreen = () => {
  return (
    <View
      style={styles.container}
    >
      <Text>Edit app/index.tsx to edit this screen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default HomeScreen;
