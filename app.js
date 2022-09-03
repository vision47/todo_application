const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const format = require("date-fns/format");
const isValid = require("date-fns/isValid");
const parseISO = require("date-fns/parseISO");
// const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
let db = null;
const dbPath = path.join(__dirname, "./todoApplication.db");

const initializeServerAndDB = async () => {
  try {
    app.listen(3000, () => {
      console.log(`Server is running at http://localhost:3000/`);
    });

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeServerAndDB();

const queryValidation = (request, response, next) => {
  try {
    const {
      status = "",
      priority = "",
      category = "",
      search_q = "",
      due_date = "",
    } = request.query;

    const priorityArray = ["HIGH", "MEDIUM", "LOW", ""];
    const statusArray = ["TO DO", "IN PROGRESS", "DONE", ""];
    const categoryArray = ["WORK", "HOME", "LEARNING", ""];

    switch (true) {
      case !statusArray.includes(status):
        response.status(400);
        response.send(`Invalid Todo Status`);
        break;
      case !priorityArray.includes(priority):
        response.status(400);
        response.send(`Invalid Todo Priority`);
        break;
      case !categoryArray.includes(category):
        response.status(400);
        response.send(`Invalid Todo Category`);
        break;
      case due_date !== "":
        const date = format(new Date(due_date), "yyyy-MM-dd");
        // console.log(typeof date);
        // console.log(date);
        request.query.due_date = date;
        next();
        break;
      default:
        next();
        break;
    }
  } catch (RangeError) {
    // console.log(`Err: ${RangeError.message}`);
    response.status(400);
    response.send(`Invalid Due Date`);
  }
};

const bodyValidation = (request, response, next) => {
  try {
    const {
      status = "",
      priority = "",
      category = "",
      dueDate = "",
    } = request.body;

    const priorityArray = ["HIGH", "MEDIUM", "LOW", ""];
    const statusArray = ["TO DO", "IN PROGRESS", "DONE", ""];
    const categoryArray = ["WORK", "HOME", "LEARNING", ""];

    switch (true) {
      case !statusArray.includes(status):
        response.status(400);
        response.send(`Invalid Todo Status`);
        break;
      case !priorityArray.includes(priority):
        response.status(400);
        response.send(`Invalid Todo Priority`);
        break;
      case !categoryArray.includes(category):
        response.status(400);
        response.send(`Invalid Todo Category`);
        break;
      case dueDate !== "":
        const date = format(new Date(dueDate), "yyyy-MM-dd");
        // console.log(typeof date);
        // console.log(date);
        request.body.dueDate = date;
        next();
        break;
      default:
        next();
        break;
    }
  } catch (RangeError) {
    // console.log(`Err: ${RangeError.message}`);
    response.status(400);
    response.send(`Invalid Due Date`);
  }
};

const convertResponseObjToTodoObj = (responseObj) => {
  if (responseObj === undefined) {
    return "Todo Doesn't Exist";
  } else {
    return {
      id: responseObj.id,
      todo: responseObj.todo,
      priority: responseObj.priority,
      status: responseObj.status,
      category: responseObj.category,
      dueDate: responseObj.due_date,
    };
  }
};

// get todos
app.get("/todos/", queryValidation, async (request, response) => {
  const {
    status = "",
    priority = "",
    category = "",
    search_q = "",
    due_date = "",
  } = request.query;
  //   console.log(due_date);
  const todoQuery = `
  SELECT * FROM todo WHERE 
  status LIKE '%${status}%' and 
  priority LIKE '%${priority}%' and 
  category LIKE '%${category}%' and 
  todo LIKE '%${search_q}%' and
  due_date LIKE '%${due_date}%';
  `;

  const todosArray = await db.all(todoQuery);
  response.send(todosArray.map(convertResponseObjToTodoObj));
});

// get todo
app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getTodoQuery = `
    SELECT * FROM todo WHERE id = ${todoId};`;
  const todo = await db.get(getTodoQuery);
  //   console.log(todo);
  response.send(convertResponseObjToTodoObj(todo));
});

// delete todo
app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const deleteTodoQuery = `
    DELETE FROM todo WHERE id = ${todoId};`;
  await db.run(deleteTodoQuery);
  response.send(`Todo Deleted`);
});

// update todo
app.put("/todos/:todoId/", bodyValidation, async (request, response) => {
  const { todoId } = request.params;
  const getTodoQuery = `
  SELECT * FROM todo WHERE 
  id = ${todoId};`;
  const previousTodo = await db.get(getTodoQuery);
  const {
    status = previousTodo.status,
    priority = previousTodo.priority,
    category = previousTodo.category,
    todo = previousTodo.todo,
    dueDate = previousTodo.due_date,
  } = request.body;
  const updateTodoQuery = `
  UPDATE todo SET
  status = '${status}',
  priority = '${priority}',
  category = '${category}',
  todo = '${todo}',
  due_date = '${dueDate}'
  WHERE id = ${todoId};`;
  await db.run(updateTodoQuery);
  switch (true) {
    case status != previousTodo.status:
      response.send(`Status Updated`);
      break;
    case priority != previousTodo.priority:
      response.send(`Priority Updated`);
      break;
    case todo != previousTodo.todo:
      response.send(`Todo Updated`);
      break;
    case category != previousTodo.category:
      response.send(`Category Updated`);
      break;
    case dueDate != previousTodo.due_date:
      response.send(`Due Date Updated`);
      break;
    default:
      break;
  }
});

// add todo
app.post("/todos/", bodyValidation, async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;
  const addTodoQuery = `
    INSERT INTO todo (id, todo, priority, status, category, due_date)
    VALUES 
    (${id}, '${todo}','${priority}','${status}','${category}','${dueDate}');`;
  await db.run(addTodoQuery);
  response.send(`Todo Successfully Added`);
});

// get todos by date
app.get("/agenda/", queryValidation, async (request, response) => {
  try {
    let { date } = request.query;
    date = format(new Date(date), "yyyy-MM-dd");
    const getTodoQuery = `
    SELECT * FROM todo WHERE 
    due_date LIKE '${date}';`;
    const todos = await db.all(getTodoQuery);
    response.send(todos.map(convertResponseObjToTodoObj));
  } catch (error) {
    response.status(400);
    response.send(`Invalid Due Date`);
  }
});

//

module.exports = app;
