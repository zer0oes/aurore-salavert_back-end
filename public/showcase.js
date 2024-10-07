const displayProjects = async () => {
    const res = await fetch('/api/projects?populate=*')
    const projects = await res.json()

    console.log('displayProjects projects:', projects)

    const container = document.querySelector('#projects')
    container.innerHTML = ' '

    let projectsData = projects.data;

    projectsData.forEach(project => {
        let projectAttr = project.attributes;

        /** THUMBNAIL **/
        const thumb = document.createElement('img')
        thumb.setAttribute('src', projectAttr.thumbnail.data.attributes.url)
        container.appendChild(thumb)

        /** TITLE **/
        const title = document.createElement('h3')
        title.innerText = projectAttr.title
        container.appendChild(title)

        /** CONTENT **/
        const description = document.createElement('p')
        description.innerText = projectAttr.description
        container.appendChild(description)
    })
}

displayProjects()