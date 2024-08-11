import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://Sahaya10:Sahaya10@sahaya.5a3kn.mongodb.net/?retryWrites=true&w=majority");
    console.log('MongoDB Connected');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

export default connectDB;
