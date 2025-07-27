const mongoose = require("mongoose");

const ListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    userId: { type: String, required: true },
    isPin: { type: Boolean, default: false },
    items: { type: Array },
  },
  { timestamps: true }
);

module.exports = mongoose.model("List", ListSchema);
