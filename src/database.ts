import mongoose from "mongoose";

const connectToDatabase = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB;

  if (!mongoURI) {
    console.error("⚠️ MongoDB URI is not defined");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI);
    console.log("⚡ Database Connected");
  } catch (error) {
    console.log("Unable to connect to the database.", error);
    process.exit(1);
  }
};

export default connectToDatabase;
