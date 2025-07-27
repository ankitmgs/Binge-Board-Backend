const express = require("express");
const router = express.Router();
const List = require("../models/List");
const sendResponse = require("../utils/response");

// Create a new list
router.post("/", async (req, res) => {
  try {
    const { name, userId, isPin } = req.body;
    // Check if list name already exists for this user
    const existingList = await List.findOne({ name, userId });
    if (existingList) {
      return sendResponse(res, 409, "List name already exists for this user");
    }
    const list = new List({
      name,
      userId, // Keep userId as string
      isPin,
      items: []
    });
    await list.save();
    sendResponse(res, 201, "List created successfully", list);
  } catch (err) {
    sendResponse(res, 400, err.message);
  }
});

// Get all lists for a user
router.get("/:userId", async (req, res) => {
  try {
    const lists = await List.find({ userId: req.params.userId }); // Keep userId as string
    sendResponse(res, 200, "Lists fetched successfully", lists);
  } catch (err) {
    sendResponse(res, 400, err.message);
  }
});

// Edit a list
router.put("/:id", async (req, res) => {
  try {
    const { name, isPin } = req.body;
    const list = await List.findByIdAndUpdate(
      req.params.id,
      { name, isPin },
      { new: true }
    );
    sendResponse(res, 200, "List updated successfully", list);
  } catch (err) {
    sendResponse(res, 400, err.message);
  }
});

// Delete a list
router.delete("/:id", async (req, res) => {
  try {
    await List.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, "List deleted successfully");
  } catch (err) {
    sendResponse(res, 400, err.message);
  }
});

// Add item to multiple lists
router.post("/addItemToLists", async (req, res) => {
  try {
    const { itemIds, movieDetail } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return sendResponse(res, 400, "No lists selected or invalid format.");
    }

    if (!movieDetail || typeof movieDetail !== 'object') {
      return sendResponse(res, 400, "Invalid item details provided.");
    }

    const addedToLists = [];
    const alreadyPresentInLists = [];
    const notFoundLists = [];

    for (const listId of itemIds) {
      const list = await List.findById(listId);
      if (list) {
        const itemExists = list.items.some(item => item.id === movieDetail.id);
        if (!itemExists) {
          list.items.push(movieDetail);
          await list.save();
          addedToLists.push(list.name);
        } else {
          alreadyPresentInLists.push(list.name);
        }
      } else {
        notFoundLists.push(listId);
      }
    }

    let message = "";
    if (addedToLists.length > 0) {
      message += `Item added to lists: ${addedToLists.join(", ")}. `;
    }
    if (alreadyPresentInLists.length > 0) {
      message += `Item already present in lists: ${alreadyPresentInLists.join(", ")}. `;
    }
    if (notFoundLists.length > 0) {
      message += `Lists not found: ${notFoundLists.join(", ")}.`;
    }

    if (addedToLists.length === 0 && alreadyPresentInLists.length === 0) {
      return sendResponse(res, 404, "No lists were updated or found for the given item.");
    }

    sendResponse(res, 200, message.trim(), { addedToLists, alreadyPresentInLists, notFoundLists });
  } catch (err) {
    sendResponse(res, 500, err.message);
  }
});

module.exports = router;
