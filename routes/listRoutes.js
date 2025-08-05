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
      items: [],
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

    if (!movieDetail || typeof movieDetail !== "object") {
      return sendResponse(res, 400, "Invalid item details provided.");
    }

    const addedToLists = [];
    const alreadyPresentInLists = [];
    const notFoundLists = [];

    for (const listId of itemIds) {
      const list = await List.findById(listId);
      if (list) {
        const itemExists = list.items.some(
          (item) => item.id === movieDetail.id
        );
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
      message += `Item already present in lists: ${alreadyPresentInLists.join(
        ", "
      )}. `;
    }
    if (notFoundLists.length > 0) {
      message += `Lists not found: ${notFoundLists.join(", ")}.`;
    }

    if (addedToLists.length === 0 && alreadyPresentInLists.length === 0) {
      return sendResponse(
        res,
        404,
        "No lists were updated or found for the given item."
      );
    }

    sendResponse(res, 200, message.trim(), {
      addedToLists,
      alreadyPresentInLists,
      notFoundLists,
    });
  } catch (err) {
    sendResponse(res, 500, err.message);
  }
});

router.post("/updateItemToLists", async (req, res) => {
  try {
    const { targetListIds, movieDetail, userId } = req.body;

    if (
      !targetListIds ||
      !Array.isArray(targetListIds) ||
      targetListIds.length === 0
    ) {
      return sendResponse(res, 400, "No target lists provided.");
    }

    if (!movieDetail || typeof movieDetail !== "object" || !movieDetail.id) {
      return sendResponse(res, 400, "Invalid or missing item detail.");
    }

    const itemId = movieDetail.id;
    const allLists = await List.find({ userId }); // Optionally: filter by userId if lists are per-user

    const addedToLists = [];
    const removedFromLists = [];
    const updatedInLists = [];
    const ratingUpdatedInLists = [];

    for (const list of allLists) {
      const hasItem = list.items.some((item) => item.id === itemId);
      const shouldHaveItem = targetListIds.includes(String(list._id));
      const itemIndex = list.items.findIndex((item) => item.id === itemId);
      const existingItem = list.items[itemIndex];

      let updated = false;

      // Always check for userRating difference first
      if (hasItem && itemIndex !== -1) {
        if (existingItem.userRating !== movieDetail.userRating) {
          list.items[itemIndex].userRating = movieDetail.userRating;
          updated = true;
          ratingUpdatedInLists.push(list.name);
        }
      }

      // Case 1: Add to list
      if (!hasItem && shouldHaveItem) {
        list.items.push(movieDetail);
        addedToLists.push(list.name);
        await list.save();
        continue;
      }

      // Case 2: Remove from list
      if (hasItem && !shouldHaveItem) {
        list.items = list.items.filter((item) => item.id !== itemId);
        removedFromLists.push(list.name);
        await list.save();
        continue;
      }

      // Case 3: Update entire item if it already exists and is in selected list
      if (hasItem && shouldHaveItem && itemIndex !== -1) {
        list.items[itemIndex] = {
          ...movieDetail,
          userRating: list.items[itemIndex].userRating, // preserve updated rating
        };
        updatedInLists.push(list.name);
        updated = true;
      }

      if (updated) {
        await list.save();
      }
    }

    // Build message
    let messageParts = [];
    if (addedToLists.length)
      messageParts.push(`Item added to: ${addedToLists.join(", ")}`);
    if (updatedInLists.length)
      messageParts.push(`Item updated in: ${updatedInLists.join(", ")}`);
    if (removedFromLists.length)
      messageParts.push(`Item removed from: ${removedFromLists.join(", ")}`);
    if (ratingUpdatedInLists.length)
      messageParts.push(
        `User rating updated in: ${ratingUpdatedInLists.join(", ")}`
      );

    const message = messageParts.length
      ? messageParts.join(". ") + "."
      : "No changes made.";

    sendResponse(res, 200, message, {
      addedToLists,
      updatedInLists,
      removedFromLists,
      ratingUpdatedInLists,
    });
  } catch (err) {
    sendResponse(res, 500, err.message);
  }
});

// Get all item IDs from all lists
router.get("/allItemIds/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const lists = await List.find({ userId });
    let allItemIds = [];

    lists.forEach((list) => {
      list.items.forEach((item) => {
        if (item.id && !allItemIds.includes(item.id)) {
          allItemIds.push(item.id);
        }
      });
    });

    sendResponse(res, 200, "All item IDs fetched successfully", allItemIds);
  } catch (err) {
    sendResponse(res, 500, err.message);
  }
});

// Get movie details and lists containing the movie for a user
router.get('/itemInLists/:userId/:itemId', async (req, res) => {
  try {
    const { userId, itemId } = req.params;
    const lists = await List.find({ userId, 'items.id': itemId });
    let movieDetails = null;
    const listNames = [];
    lists.forEach(list => {
      const foundItem = list.items.find(item => item.id === itemId);
      if (foundItem) {
        if (!movieDetails) movieDetails = foundItem;
        listNames.push(list.name);
      }
    });
    if (!movieDetails) {
      return sendResponse(res, 404, 'Movie not found in any list for this user');
    }
    sendResponse(res, 200, 'Movie details and lists fetched successfully', {
      movieDetails,
      lists: listNames
    });
  } catch (err) {
    sendResponse(res, 500, err.message);
  }
});

module.exports = router;
