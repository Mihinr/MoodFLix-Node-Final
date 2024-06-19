const db = require("../common/database");
const { recommendMovies, content_recommendation } = require("../controllers/prediction_controller");

jest.setTimeout(120000); // Increase the global timeout for Jest

describe("Recommendation Controller", () => {
  const mockConnection = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  };

  beforeAll(() => {
    db.getMySQLConnection = jest.fn().mockReturnValue(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("content_recommendation", () => {
    it("should recommend movies based on genre", async () => {
      const mockGenre = "Action";
      const mockUserId = 1;

      mockConnection.query.mockImplementation((query, params, callback) => {
        console.log('Query:', query);
        console.log('Params:', params);

        if (query.includes("FROM MoodFlix.Movies AS m WHERE m.genre LIKE ?")) {
          callback(null, [
            { movieId: 1, title: "Movie 1", original_row_number: 0 },
            { movieId: 2, title: "Movie 2", original_row_number: 1 },
          ]);
        } else if (query.includes("SELECT * FROM (SELECT ROW_NUMBER() OVER")) {
          callback(null, [
            { movieId: 1, title: "Movie 1" },
            { movieId: 2, title: "Movie 2" },
          ]);
        } else {
          callback(null, []);
        }
      });

      const recommendations = await content_recommendation(mockUserId, null, mockGenre);
      console.log('Recommendations:', recommendations);
      expect(recommendations).toHaveLength(10);
    });

    it("should handle no movies found for genre", async () => {
      const mockGenre = "NonExistentGenre";
      const mockUserId = 1;

      mockConnection.query.mockImplementation((query, params, callback) => {
        console.log('Query:', query);
        console.log('Params:', params);

        callback(null, []);
      });

      await expect(content_recommendation(mockUserId, null, mockGenre)).rejects.toThrow("No movie found with the specified genre");
    });
  });

  describe("recommendMovies", () => {
    it("should recommend movies using hybrid filtering", async () => {
      const mockUserId = 1;
      const mockEmotion = "Happy";
      const mockGenre = "Comedy";

      mockConnection.query.mockImplementation((query, params, callback) => {
        console.log('Query:', query);
        console.log('Params:', params);

        if (query.includes("FROM MoodFlix.Movies AS m WHERE m.genre LIKE ?")) {
          callback(null, [
            { movieId: 1, title: "Movie 1", original_row_number: 0 },
            { movieId: 2, title: "Movie 2", original_row_number: 1 },
          ]);
        } else if (query.includes("SELECT * FROM (SELECT ROW_NUMBER() OVER")) {
          callback(null, [
            { movieId: 1, title: "Movie 1" },
            { movieId: 2, title: "Movie 2" },
          ]);
        } else {
          callback(null, []);
        }
      });

      const recommendations = await recommendMovies(mockUserId, mockEmotion, mockGenre);
      console.log('Recommendations:', recommendations);
      expect(recommendations).toHaveLength(10);
    });

    it("should handle no recommendations found", async () => {
      const mockUserId = 1;
      const mockEmotion = "Sad";

      mockConnection.query.mockImplementation((query, params, callback) => {
        console.log('Query:', query);
        console.log('Params:', params);

        callback(null, []);
      });

      const recommendations = await recommendMovies(mockUserId, mockEmotion, null);
      console.log('Recommendations:', recommendations);
      expect(recommendations).toHaveLength(0);
    });
  });
});
