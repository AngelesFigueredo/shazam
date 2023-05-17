const express = require("express");
const router = express.Router();
const axios = require("axios");
const SpotifyWebApi = require("spotify-web-api-node");

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

spotifyApi
  .clientCredentialsGrant()
  .then((data) => {
    spotifyApi.setAccessToken(data.body["access_token"]);
  })
  .catch((error) =>
    console.log("Something went wrong when retrieving an access token", error)
  );

const {
  isLoggedIn,
  isLoggedOut,
  checkRole,
} = require("../middlewares/route-guard");
const User = require("../models/User.model");
const Post = require("../models/Post.model");
const Playlist = require("../models/Playlist.model");
const Event = require("../models/Events.model");

/* GET home page */

router.get("/new-playlist", async (req, res, next) => {
  const { currentUser } = req.session;
  const user = await User.findById(currentUser._id);
  res.render("main/new-playlist", { user });
});

router.get("/playlists-list/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentUser } = req.session;
    const user = await User.findById(id);
    const ownedPlaylists = await Playlist.find({ author: id });
    const followedPlaylists = await Playlist.find({
      followers: { $in: id },
    });
    res.render("main/playlists", {
      ownedPlaylists,
      followedPlaylists,
      currentUser,
      user,
      id,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.get("/my-playlists", async (req, res, next) => {
  try {
    const { currentUser } = req.session;
    const user = await User.findById(currentUser._id);
    const id = user._id;
    const ownedPlaylists = await Playlist.find({ author: user._id });
    const followedPlaylists = await Playlist.find({
      followers: { $in: user._id },
    });
    res.render("main/playlists", {
      ownedPlaylists,
      followedPlaylists,
      currentUser,
      user,
      id,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.get("/playlist-details/:id", async (req, res, next) => {
  try {
    const { currentUser } = req.session;
    const { id } = req.params
    const playlist = await Playlist.findById(req.params.id).populate("author");
    const playlistAuthorId = playlist.author._id.toString()
    const user = await User.findById(currentUser._id).populate({
      path: "playlists",
      select: "title",
    });

    const trackPromises = playlist.songs.map((song) =>
      spotifyApi.getTrack(song)
    );
    const trackResponses = await Promise.all(trackPromises);
    const songs = trackResponses.map((response) => response.body);
;
    res.render("main/playlist-details", { 
      playlist, 
      songs, 
      user, 
      id,
      canFollow: !playlist.followers.includes(currentUser._id) && playlistAuthorId !== currentUser._id,
      canUnfollow: playlist.followers.includes(currentUser._id),
      isOwner: playlistAuthorId === currentUser._id
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.get("/new-playlist/:id", async (req, res, next) => {
  const { currentUser } = req.session;
  const { id } = req.params
  const user = await User.findById(currentUser._id);
  res.render("main/new-playlist", { user, id });
});

router.post("/new-playlist", async (req, res, next) => {
  const { body } = req;
  const playlist = await Playlist.create(body);
  await User.findByIdAndUpdate(body.author, { playlists: playlist._id });
  res.redirect("/my-playlists");
});

router.post("/new-playlist/:id", async (req, res, next) => {
  const { body } = req;
  const { id } = req.params
  const playlist = await Playlist.create(body);
  await User.findByIdAndUpdate(body.author, { playlists: playlist._id });
  res.redirect("/my-playlists");
});

router.post("/:id/addtoplaylist", async (req, res, next) => {
  try {
    const { playlists } = req.body;
    await Playlist.findByIdAndUpdate(playlists, {
      $push: { songs: req.params.id },
    });
    res.redirect("/my-playlists");
  } catch (error) {
    console.log(error);
  }
});

router.post("/follow-playlist/:id", async (req, res, next) => {
  try {
    const { currentUser } = req.session;
    const { id } = req.params;

    await Playlist.findByIdAndUpdate(id, {
      $addToSet: { followers: currentUser._id },
    });
    res.redirect(`/playlist-details/${id}`);
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.post("/unfollow-playlist/:id", async (req, res, next) => {
  try {
    const { currentUser } = req.session;
    const { id } = req.params;

    await User.findByIdAndUpdate(currentUser._id, { $pull: { playlists: id } });
    await Playlist.findByIdAndUpdate(id, {
      $pull: { followers: currentUser._id },
    });
    res.redirect(`/playlist-details/${id}`);
  } catch (error) {
    console.log(error);
  }
});

router.post("/delete-playlist/:id", async (req, res, next)=> {
  try {
    const { id } = req.params
    await Playlist.findByIdAndDelete(id)
    res.redirect("/my-playlists")
  } catch (error) {
    console.log(error)
  }
})

module.exports = router;