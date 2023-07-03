const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const app = express();

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());
const port = 3000;
let db = null;
const initializeDatabaseAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(port, () => {
      console.log(`This server runs at PORT: ${port}`);
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(-1);
  }
};

initializeDatabaseAndServer();

const authorization = (request, response, next) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkingUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkingUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrectPassword = await bcrypt.compare(password, dbUser.password);
    if (isCorrectPassword === true) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "SECRET");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// get states
app.get("/states/", authorization, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const states = await db.all(getStatesQuery);
  response.send(states);
});

// get state by id
app.get("/states/:stateId/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const states = await db.get(getStatesQuery);
  response.send(states);
});

// create district
app.post("/districts/", authorization, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
  INSERT INTO
    district ( district_name, state_id, cases, cured, active, deaths )
VALUES ('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// get district by id
app.get("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`;
  const district = await db.get(getDistrictQuery);
  response.send(district);
});

// delete district by id
app.delete(
  "/districts/:districtId/",
  authorization,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = '${districtId}';`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// update district by id
app.put("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `
    UPDATE 
        district 
    SET 
        district_name = '${districtName}',
        state_id = '${stateId}',
        cases = '${cases}',
        cured = '${cured}',
        active = '${active}',
        deaths = '${deaths}'
    WHERE 
        district_id = '${districtId}';`;
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

// get stats from state
app.get("/states/:stateId/stats/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getAllStatesQuery = `
    SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
    FROM 
        district 
        WHERE 
        state_id = ${stateId};`;
  const stats = await db.get(getAllStatesQuery);
  response.send({
    totalCases: stats["SUM(cases)"],
    totalCured: stats["SUM(cured)"],
    totalActive: stats["SUM(active)"],
    totalDeaths: stats["SUM(deaths)"],
  });
});

module.exports = app;