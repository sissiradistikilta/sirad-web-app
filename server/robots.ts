import { Request, Response } from "express";

export default (request: Request, response: Response) => {
  response.header("Content-Type", "text/plain; charset=utf-8");
  if (process.env.ROBOTS_ALLOW_ALL === "true") {
    response.send("User-agent: *\nAllow: /");
  } else {
    response.send("User-agent: *\nDisallow: /");
  }
};
