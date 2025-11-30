export class ApiResponse {
  static success(res, data, message = "Sucesso", statusCode = 200) {
    return res.status(statusCode).json({
      status: "success",
      message,
      data,
    });
  }

  static error(res, message, statusCode = 500, errors = null) {
    const response = {
      status: "error",
      message,
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  static paginated(res, data, pagination, message = "Sucesso") {
    return res.status(200).json({
      status: "success",
      message,
      data,
      pagination,
    });
  }
}




















