
let tabs = document.querySelectorAll('.tab');
let containers = document.querySelectorAll('.tab-container');

const activedTab = function() {
	let containerId = this.id + '-container';

	for(let i = 0; i<tabs.length; i++) {
		if(tabs[i].id == this.id) {
			this.setAttribute('aria-current', 'true');
			this.classList.add('active-tab');
	} else {
			tabs[i].setAttribute('aria-current', 'false');
			tabs[i].classList.remove('active-tab');
		}
	}

	for(let i = 0; i<containers.length; i++) {
		if(containers[i].id == containerId) {
			containers[i].style.display = 'inline';
	} else {
			containers[i].style.display = 'none';
		}
	}


};

window.addEventListener('load', function() {
	let activeTab = tabs[0];
	let activeContainer = containers[0];
	activeTab.setAttribute('aria-current', 'true');
	activeTab.classList.add('active-tab');
	activeContainer.style.display = 'inline';
	for(let i = 0; i<tabs.length; i++) {
		tabs[i].addEventListener('click', activedTab);
	}
});
