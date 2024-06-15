const fs = require("fs");
const db = require("../common/database");

// Load the cosine similarity matrix from the JSON file
const jsonFilePath = "cosine_similarity_model_1.json";
const cosine_sim = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

function get_index_from_genre(genre, callback) {
  const connection = db.getMySQLConnection();
  connection.connect();
  connection.query(
    "SELECT m.*,(SELECT COUNT(*) FROM MoodFlix.Movies AS m2 WHERE m2.movieId < m.movieId) AS original_row_number,ROW_NUMBER() OVER (ORDER BY m.movieId) AS rowNo FROM MoodFlix.Movies AS m WHERE m.genre LIKE ? ORDER BY m.movieId",
    [genre],
    (error, results) => {
      connection.end();
      if (error) {
        console.error("Error fetching movie index:", error);
        callback(error, null);
      } else {
        if (results.length > 0) {
          // console.log(
          //   "Movie index for genre:",
          //   results[0].original_row_number + 1
          // ); // Add logging
          callback(null, results[0].original_row_number + 1); // Assuming 'id' is the primary key column in your movies table
        } else {
          console.error("No movie found with the specified genre:", genre);
          callback(new Error("No movie found with the specified genre"), null);
        }
      }
    }
  );
}

function get_index_from_Emotions(Emotions, callback) {
  const connection = db.getMySQLConnection();
  connection.connect();
  connection.query(
    "SELECT m.*,(SELECT COUNT(*) FROM MoodFlix.Movies AS m2 WHERE m2.movieId < m.movieId) AS original_row_number,ROW_NUMBER() OVER (ORDER BY m.movieId) AS rowNo FROM MoodFlix.Movies AS m WHERE m.emotions LIKE ? ORDER BY m.movieId",
    [Emotions],
    (error, results) => {
      connection.end();
      if (error) {
        console.error("Error fetching movie index:", error);
        callback(error, null);
      } else {
        if (results.length > 0) {
          // console.log(
          //   "Movie index for emotions:",
          //   results[0].original_row_number
          // ); // Add logging
          callback(null, results[0].original_row_number); // Assuming 'id' is the primary key column in your movies table
        } else {
          console.error("No movie found with the specified emotion:", Emotions);
          callback(
            new Error("No movie found with the specified emotion"),
            null
          );
        }
      }
    }
  );
}

// Function to get title from index
function get_title_from_index(index) {
  return new Promise((resolve, reject) => {
    index = index + 1;
    const connection = db.getMySQLConnection();
    connection.connect();
    connection.query(
      "SELECT * FROM (SELECT ROW_NUMBER() OVER (ORDER BY movieId) AS rowNo,posterLink, movieId,title,releasedYear,genre,imdbRating,overview,emotions FROM MoodFlix.Movies) AS sorted_movies WHERE rowNo = ?",
      [index],
      (error, results) => {
        connection.end();
        if (error) {
          console.error("Error fetching movie title:", error);
          reject(error);
        } else {
          if (results.length > 0) {
            resolve(results);
          } else {
            console.error("No movie found with the specified index:", index);
            reject(new Error("No movie found with the specified index"));
          }
        }
      }
    );
  });
}

// Content recommendation function
async function content_recommendation(user_ID, emotion_detected, genre_detected) {
  if (!genre_detected && !emotion_detected) {
    console.error("Both genre_detected and emotion_detected are empty");
    return []; // Return an empty array when both parameters are empty
  }

  let movie_index;

  function getMovieIndex() {
    return new Promise((resolve, reject) => {
      if (genre_detected) {
        get_index_from_genre(genre_detected, (error, index) => {
          if (error) {
            console.error("Error fetching movie index:", error);
            reject(error);
          } else {
            movie_index = index;
            resolve();
          }
        });
      } else if (emotion_detected) {
        get_index_from_Emotions(emotion_detected, (error, index) => {
          if (error) {
            console.error("Error fetching movie index:", error);
            reject(error);
          } else {
            movie_index = index;
            resolve();
          }
        });
      }
    });
  }

  function recommendSimilarMovies() {
    if (typeof movie_index === "undefined") {
      console.error("Movie index is undefined");
      return [];
    }

    // Convert movie index to string to ensure compatibility with the cosine_sim matrix
    const movieIndexString = String(movie_index);

    if (!(movieIndexString in cosine_sim)) {
      console.error("No similar movies found for the specified genre/emotion");
      return [];
    }

    const similar_movies = Object.entries(cosine_sim[movieIndexString]);

    const sorted_similar_movies = similar_movies
      .sort((a, b) => b[1] - a[1])
      .slice(1, 11); // Adjusted to return 10 similar movies

    return Promise.all(
      sorted_similar_movies.map(async (element) => {
        try {
          const title = await get_title_from_index(Number(element[0]));
          return title[0]; // Unwrap the result from array
        } catch (error) {
          console.error("Error fetching movie title:", error);
          return null;
        }
      })
    );
  }

  // Call getMovieIndex and then call recommendSimilarMovies
  await getMovieIndex();
  let movies = await recommendSimilarMovies();

  // Randomly select a subset of movies if more than 10 are returned
  if (movies.length > 10) {
    movies = getRandomSubset(movies, 10);
  }

  // Filter out null results
  return movies.filter(movie => movie !== null);
}


// Function to select a random subset of movies
function getRandomSubset(array, size) {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}



function get_movie_details_by_title(title) {
  return new Promise((resolve, reject) => {
    const connection = db.getMySQLConnection();
    connection.connect();
    connection.query(
      "SELECT * FROM MoodFlix.Movies WHERE title = ?",
      [title],
      (error, results) => {
        connection.end();
        if (error) {
          console.error("Error fetching movie details:", error);
          reject(error);
        } else {
          if (results.length > 0) {
            resolve(results[0]);
          } else {
            console.error("No movie found with the specified title:", title);
            reject(new Error("No movie found with the specified title"));
          }
        }
      }
    );
  });
}

function collabRecommendation(userID, emotionDetected) {
  const connection = db.getMySQLConnection();
  connection.connect();

  const query = `
  SELECT Ratings.*, Movies.title
  FROM MoodFlix.Ratings
  INNER JOIN MoodFlix.Movies ON Ratings.movieId = Movies.movieId
  WHERE Movies.emotions = ?`;

  return new Promise((resolve, reject) => {
    connection.query(query, [emotionDetected], async (error, results) => {
      if (error) {
        console.error("Error fetching data:", error);
        reject(error);
      } else {
        const userProfiles = results.filter(
          (record) => record.userId === userID && record.rating > 1
        );
        const preferences = userProfiles.map((record) => record.title);

        const ratings = {};
        const counts = {};
        results.forEach((record) => {
          if (!ratings[record.title]) {
            ratings[record.title] = 0;
            counts[record.title] = 0;
          }
          ratings[record.title] += record.rating;
          counts[record.title]++;
        });

        const averages = {};
        Object.keys(ratings).forEach((title) => {
          averages[title] = ratings[title] / counts[title];
        });

        const similarMovies = {};
        userProfiles.forEach((record) => {
          Object.keys(averages).forEach((title) => {
            if (!similarMovies[title]) {
              similarMovies[title] = 0;
            }
            similarMovies[title] += record.rating - averages[title];
          });
        });

        // Shuffle the similar movies array before sorting
        const shuffledSimilarMovies = Object.entries(similarMovies).sort(() => 0.5 - Math.random());

        const sortedSimilarMovies = shuffledSimilarMovies
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map((entry) => entry[0]);

        // Fetch detailed movie information for the recommended movies
        const detailedMovies = await Promise.all(
          sortedSimilarMovies
            .filter((movie) => !preferences.includes(movie))
            .map(async (title) => {
              try {
                return await get_movie_details_by_title(title);
              } catch (error) {
                console.error("Error fetching movie details:", error);
                return null;
              }
            })
        );

        // Close connection
        connection.end();

        // Resolve with detailed movie information
        resolve(detailedMovies.filter((movie) => movie !== null));
      }
    });
  });
}

// Function to recommend movies using hybrid filtering
async function recommendMovies(userID, emotionDetected, genreDetected) {
  try {
    const colab = await collabRecommendation(userID, emotionDetected);
    const content = await content_recommendation(
      userID,
      emotionDetected,
      genreDetected
    );

    let recommendedMovies = [];

    if (content.length > 0) {
      // console.log("You may also like:", content);
      recommendedMovies.push(...content);
    }

    if (colab.length > 0) {
      // console.log("Other users have also watched:", colab);
      recommendedMovies.push(...colab);
    }

    if (colab.length === 0) {
      console.log("No results found");
    }

    // Shuffle the final recommended movies array
    recommendedMovies = recommendedMovies.sort(() => 0.5 - Math.random());

    return recommendedMovies;
  } catch (error) {
    console.error(error);
    return [];
  }
}


module.exports = {
  recommendMovies,
  content_recommendation,
};