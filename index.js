const fs = require("fs");
var mysql = require("mysql");
var optionalRequire = require("optional-require")(require);
let allSQL = [];

const newConnection = () => {
  let config = {
    ...require("./secrets"),
    ...optionalRequire("./secrets.dev"),
    multipleStatements: true
  };
  console.debug(config);

  let dbConn = mysql.createConnection(config);
  dbConn.connect();
  return dbConn;
};

const walk = async (dir, ext, level) => {
  let results = [];
  level++;
  console.log(`level ${level}`, dir);

  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + "/" + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file, ext, level));
    } 
    else 
    {
      file_type = file.split(".").pop();
      file_name = file.split(/(\\|\/)/g).pop();
      if (file_type == ext) {
        const imageInfo = require(`${file}`);
        anpr = imageInfo.registration.finalANPRResult;
        let res = {
          filename: file,
          lp: anpr.licensePlateNumber,
          country: anpr.nationality,
          timestamp: new Date(imageInfo.registration.time.timestamp * 1000.0 + imageInfo.registration.time.milliSeconds),
          len: anpr.vehicleLength,
          conf: anpr.ocrScore,
          classifier_rdwclass: imageInfo.classifierInfo ? imageInfo.classifierInfo.result.rdwvehicleclass : "NULL",
          coords: {
            topleftx: anpr.plateTopLeftX,
            toplefty: anpr.plateTopLeftY,
            toprightx: anpr.plateTopRightX,
            toprighty: anpr.plateTopRightY,
            bottomleftx: anpr.plateBottomLeftX,
            bottomlefty: anpr.plateBottomLeftY,
            bottomrightx: anpr.plateBottomRightX,
            bottomrighty: anpr.plateBottomRightY
          }
        };
        if (res.lp != "") results.push(res);
      }
    }
  });
  
  let insertSQL = [];
  results.forEach(f => {
    try {
      if (f.filename)
        insertSQL.push(
          `(${imagesSetId}, '${f.filename.replace(
            startDir,
            ""
          )}', 
            '${f.timestamp
                  .toISOString()
                  .replace("T", " ")
                  .replace("Z", "")}', '${f.lp.replace(/ /g, "")}', '${f.country}', ${f.len}, ${f.conf}, ${f.coords.topleftx}, ${f.coords.toplefty}, ${f.coords.toprightx}, ${f.coords.toprighty}, ${f.coords.bottomrightx}, ${f.coords.bottomrighty}, ${f.coords.bottomleftx}, ${f.coords.bottomlefty}, '${f.classifier_rdwclass}')`
        );
    } catch (e) {
      console.error(e);
    }
  });
  if (insertSQL.length > 0) {
    insertSQL =
      `INSERT IGNORE INTO scl_image (scl_imagesetid, filename, timestamp, lp, country, len, conf, topleftx, toplefty, toprightx, toprighty, bottomrightx, bottomrighty, bottomleftx, bottomlefty, classifier_rdwclass) VALUES ` +
      insertSQL.join(", \n");
    allSQL.push(insertSQL);
  }
  level--;
  if (level === 0) {    
    const sql = allSQL.join(";\n\n");
    fs.writeFile(startDir + "/insert.sql", sql, e => {
      console.error(e || "Save OK");

      var dbConn = newConnection();
      dbConn.query(sql, [], function(error, results, fields) {
        console.log(error || "Inserts OK");
        
        dbConn.commit(err => {
          console.error(err || "Commit OK");
          dbConn.end();
        });
      });
    });
  }
  return results;
};

const startDir = process.argv[2];
let imagesSetId = null;
function main() {
  var dbConn = newConnection();
  dbConn.query(
    "insert ignore into scl_imageset(scl_imageset,basepath) values (?,?)", [startDir, startDir],
    function(error, results, fields) 
    {
      console.error(error || "Insert OK");
      imagesSetId = results ? results.insertId : 5;
      dbConn.commit(error => {
        console.error(error || "Commit OK");
        dbConn.end(e => {
          console.error(e || "Destruct conn OK");
          walk(startDir, "json", 0);
        });
      });
    }
  );
}

main();
