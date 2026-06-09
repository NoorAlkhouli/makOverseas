// src/services/api/employeeService.js
import apiClient from "./apiClient";

const employeeService = {
    async listEmployees() {
        const response = await apiClient.get("/api/v1/employees");
        return response.data;
    },
};

export default employeeService;