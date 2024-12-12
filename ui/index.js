document.addEventListener('DOMContentLoaded', loadEmployeeData);

/* To load employee data */
function loadEmployeeData() {

    fetch('http://54.86.150.4:4999/employees')  
        .then(response => {
            if (response.status === 200) {
                return response.json();
            } else {
                throw new Error('Failed to load employee data');
            }
        })
        .then(data => {
            const employeeTableBody = document.getElementById('employeeTableBody');
            employeeTableBody.innerHTML = ''; 

            data.forEach(employee => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${employee.FirstName}</td>
                    <td>${employee.LastName}</td>
                    <td>${employee.EmployeeId}</td>
                    <td>${employee.ContactNumber}</td>
                `;
                employeeTableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Could not load employee data.');
        });
}
