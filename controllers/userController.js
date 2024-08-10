import crypto from "crypto";
import User from "../models/User.js";
import { errorHandler } from "./../utils/error.js";
import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import { sendMail } from "../utils/mail.js";
import { validRoles } from "../models/User.js";
import jwt from "jsonwebtoken";


export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const { password, ...rest } = user._doc;
    res.status(200).json(rest);
  } catch (error) {
    next(error);
  }
};

// User signup function
export const signUp = async (req, res, next) => {
  const { username, email, password, role } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(errorHandler(400, "User already exists with this email"));
    }

    // Validate password strength
    if (password.length < 6) {
      return next(errorHandler(400, "Password must be at least 6 characters long"));
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user object
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || "user", // Default role if not provided
    });

    // Save the user to the database
    await newUser.save();

    // Generate a JWT token for the newly registered user
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h", // Token expiration time
    });

    // Send the token in a cookie, ensuring it's secure and httpOnly
    res
      .cookie("access_token", token, {
        httpOnly: true, // Ensures cookie is not accessible via client-side scripts
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      })
      .status(201)
      .json({
        message: "User registered successfully",
        user: {
          id: newUser._id,
          email: newUser.email,
          username: newUser.username,
          role: newUser.role,
        },
      });

  } catch (error) {
    console.error("Signup error:", error);
    next(error);
  }
};

export const signIn = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return next(errorHandler(401, "Invalid email or password"));
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(errorHandler(401, "Invalid email or password"));
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h", // Token expires in 1 hour
    });

    // Send token in a cookie
    res
      .cookie("access_token", token, {
        httpOnly: true, // Prevents access to the cookie via client-side scripts
   // Use secure cookies in production
      })
      .status(200)
      .json({
        message: "Signed in successfully",
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
      });
  } catch (error) {
    next(error);
  }
};

export const getTotalUsers = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    res.status(200).json({ totalUsers });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  if (req.user.id !== req.params.userId) {
    return res
      .status(401)
      .json({ message: "You are not authorized to update this user" });
  }

  try {
    if (req.body.password) {
      if (req.body.password.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters long" });
      }
      req.body.password = bcrypt.hashSync(req.body.password, 10);
    }

    if (req.body.username) {
      if (req.body.username.includes(" ")) {
        return res
          .status(400)
          .json({ message: "Username must not contain spaces" });
      }
      if (!req.body.username.match(/^[a-zA-Z0-9]+$/)) {
        return res.status(400).json({
          message: "Username must only contain alphanumeric characters",
        });
      }
    }

    const { role, profession, experience, city, age, ...updatedFields } =
      req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updatedFields },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const { password, ...rest } = updatedUser.toObject();
    res.status(200).json(rest);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const signOut = (req, res, next) => {
  try {
    res
      .clearCookie("access_token")
      .status(200)
      .json("User has been signed out");
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res) => {
  const { userId, newRole } = req.body;
  console.log("Request Body:", req.body);

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    user.role = newRole;
    await user.save();

    return res.status(200).json({ message: "User role updated successfully" });
  } catch (error) {
    console.error("Error updating user role:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    const resetToken = crypto.randomBytes(25).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 3600000;
    await user.save();

    const url = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
    const text = `Click on this link to reset your password: ${url}. If you did not request this, please ignore.`;

    await sendMail(user.email, "Reset Password", text);

    res.status(200).json({
      message: `Reset password link has been sent to ${user.email}`,
    });
  } else {
    res.status(401);
    throw new Error("Invalid Credentials");
  }
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired token");
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.status(200).json({
    message: "Password has been reset successfully",
  });
});
