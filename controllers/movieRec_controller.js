const db = require("../common/database");
const {
  recommendMovies,
  content_recommendation,
} = require("./prediction_controller");

exports.movieRec = (req, res) => {
  if (!req.session || !req.session.userid) {
    return res.redirect("/login");
  }
  var emotion = req.session.prediction;
  var userid = req.session.userid;
  var newUser = req.session.newUser;
  var genre = req.session.genre;

  let dbRecordList = [];

  if (emotion == "Neutral" || newUser) {
    content_recommendation(userid, emotion, genre)
      .then((recommendations) => {
        if (recommendations.length > 0) {
          // Ensure the recommendations are wrapped in an array
          res.render("movieRec", { dbRecordList: [recommendations] });
        } else {
          res.redirect("/noRecommendations");
        }
      })
      .catch((error) => {
        console.error(error);
        res
          .status(500)
          .send("An error occurred while fetching movie recommendations.");
      });
  } else {
    recommendMovies(userid, emotion, "")
      .then((recommendations) => {
        if (recommendations.length > 0) {
          // Ensure the recommendations are wrapped in an array
          res.render("movieRec", { dbRecordList: [recommendations] });
        } else {
          res.redirect("/noRecommendations");
        }
      })
      .catch((error) => {
        console.error(error);
        res
          .status(500)
          .send("An error occurred while fetching movie recommendations.");
      });
  }
};

exports.movieRecPost = (req, res) => {
  if (!req.session || !req.session.userid) {
    return res.redirect("/login");
  }

  var userid = req.session.userid;
  var emotion = req.session.prediction;
  const movieIds = req.body.movieIds || [];
  const ratings = {};
  const saveForLater = {};

  // Collect ratings and save for later choices from the request body
  for (const key in req.body) {
    if (key.startsWith("rating_")) {
      const movieId = key.replace("rating_", "");
      ratings[movieId] = req.body[key];
    } else if (key.startsWith("saveForLater_")) {
      const movieId = key.replace("saveForLater_", "");
      saveForLater[movieId] = true;
    }
  }

  var connection = db.getMySQLConnection();
  connection.connect();

  // Handle ratings
  if (Object.keys(ratings).length > 0) {
    // Prepare a single query to insert all ratings
    let ratingValues = [];
    for (const movieId in ratings) {
      let rating = ratings[movieId];
      ratingValues.push([userid, movieId, rating]);
    }

    let ratingSql = "INSERT INTO MoodFlix.Ratings (userid, movieId, rating) VALUES ?";
    connection.query(ratingSql, [ratingValues], (err, rows) => {
      if (err) {
        console.error(err.stack);
        return res.send(err.message);
      } else {
        console.log("Ratings inserted successfully!");
      }
    });
  }

  // Handle save for later
  if (Object.keys(saveForLater).length > 0) {
    // Prepare the SQL query to insert movies for later
    let saveValues = [];
    for (const movieId in saveForLater) {
      saveValues.push([userid, movieId, emotion]);
    }

    let saveSql = "INSERT INTO MoodFlix.SavedMovies (userId, movieId, emotion) VALUES ?";
    connection.query(saveSql, [saveValues], (err, rows) => {
      if (err) {
        console.error("Error saving movies for later:", err);
      } else {
        console.log("Movies saved for later successfully!");
      }
    });
  }

  connection.end();
  return res.redirect("/thankyou");
};

exports.thankYou = (req, res) => {
  if (!req.session || !req.session.userid) {
    return res.redirect("/login");
  }
  res.render("thankYou");
};

exports.noRecommendation = (req, res) => {
  if (!req.session || !req.session.userid) {
    return res.redirect("/login");
  }
  res.render("noRecommendations");
};
