const db = require("../common/database");

exports.savedMovies = (req, res) => {
  if (!req.session || !req.session.userid) {
    return res.redirect("/login");
  }
  
  var dbRecordList = [];
  var userId = req.session.userid;
  var connection = db.getMySQLConnection();
  
  connection.connect();
  
  // First query to get distinct movieId
  connection.query(
    "SELECT DISTINCT movieId FROM MoodFlix.SavedMovies WHERE userId = ?",
    [userId],
    (err, result) => {
      if (err) {
        console.log(err);
        res.send(err.stack);
        connection.end();
        return;
      } else {
        if (result.length > 0) {
          // Array of Promises for second query
          let movieDetailPromises = result.map(row => {
            return new Promise((resolve, reject) => {
              connection.query(
                "SELECT * FROM MoodFlix.Movies WHERE movieId = ?",
                [row.movieId],
                (err, movieResult) => {
                  if (err) {
                    reject(err);
                  } else {
                    if (movieResult.length > 0) {
                      let movie = movieResult[0];
                      let dbRecord = {
                        posterLink: movie.posterLink,
                        title: movie.title,
                        description: movie.overview,
                        imdbRating: movie.imdbRating
                      };
                      resolve(dbRecord);
                    } else {
                      resolve(null);
                    }
                  }
                }
              );
            });
          });
          
          // Execute all movie detail queries
          Promise.all(movieDetailPromises)
            .then(movieDetails => {
              // Filter out any null results (in case no movie details were found for some IDs)
              dbRecordList = movieDetails.filter(movie => movie !== null);
              connection.end();
              res.render("savedMovies", { dbRecordList: dbRecordList });
            })
            .catch(error => {
              console.log(error);
              res.send(error.stack);
              connection.end();
            });
        } else {
          connection.end();
          res.render("savedMovies", { dbRecordList: [] });
        }
      }
    }
  );
};
