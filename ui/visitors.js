document.addEventListener('DOMContentLoaded', loadVisitorData);

/* To load visitor data */
function loadVisitorData() {

    fetch('http://54.86.150.4:4999/visitors')  
        .then(response => {
            if (response.status === 200) {
                return response.json();
            } else {
                throw new Error('Failed to load visitor data');
            }
        })
        .then(data => {
            const visitorsTableBody = document.getElementById('visitorsTableBody');
            visitorsTableBody.innerHTML = ''; 

            data.forEach(visitor => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${visitor.VisitorId}</td>
                    <td>${visitor.FirstName || 'N/A'}</td>
                    <td>${visitor.LastName || 'N/A'}</td>
                    <td>${visitor.EmployeeId || 'N/A'}</td>
                    <td>${visitor.ContactNumber || 'N/A'}</td>
                    <td>${visitor.Timestamp}</td>
                    <td>${visitor.Attendance || 'Not Marked'}</td>
                    <td>
                        ${visitor.ImageData 
                            ? `<img src="${visitor.ImageData}" alt="Visitor Image" class="thumbnail">`
                            : 'No Image'}
                    </td>
                `;
                visitorsTableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Could not load visitor data.');
        });
}
