import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { RepoIcon, StarIcon, RepoForkedIcon, TriangleDownIcon } from './icons';
import { getLanguageColor } from '../lib/languageStats';
import ReposStyles from './styles/ReposStyles';
import DropdownStyles from './styles/DropdownStyles';
import { Section } from '../style';

const LIMIT = 8;
const SORT_PROPERTIES = {
  stars: 'stargazers_count',
  forks: 'forks_count',
  size: 'size',
};
const sortTypes = Object.keys(SORT_PROPERTIES);

const Repos = ({ repoData }) => {
  const [sortType, setSortType] = useState('stars');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const topRepos = useMemo(() => {
    const sortProperty = SORT_PROPERTIES[sortType];
    return repoData
      .filter(repo => !repo.fork)
      .sort((a, b) => b[sortProperty] - a[sortProperty])
      .slice(0, LIMIT);
  }, [repoData, sortType]);

  const toggleDropdown = () => setDropdownOpen(open => !open);

  const changeRepoSort = type => {
    setSortType(type);
    setDropdownOpen(false);
  };

  return (
    <Section>
      <ReposStyles>
        <header>
          <h2>Top Repos</h2>
          <div className="dropdown-wrapper">
            <span className="label">by</span>
            <DropdownStyles $active={dropdownOpen}>
              <button
                type="button"
                className="dropdown__button"
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
                onClick={toggleDropdown}>
                <span className="dropdown__label">{sortType}</span>
                <TriangleDownIcon />
              </button>
              <ul className="dropdown__list">
                {sortTypes.map(type => (
                  <li className="dropdown__list-item" key={type}>
                    <button type="button" onClick={() => changeRepoSort(type)}>
                      {type}
                    </button>
                  </li>
                ))}
              </ul>
            </DropdownStyles>
          </div>
        </header>

        <div className="repo-list">
          {topRepos.length > 0 ? (
            <ul>
              {topRepos.map(repo => (
                <li key={repo.id}>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="repo">
                    <div className="repo__top">
                      <div className="repo__name">
                        <RepoIcon />
                        <h3>{repo.name}</h3>
                      </div>
                      <p>{repo.description}</p>
                    </div>
                    <div className="repo__stats">
                      <div className="repo__stats--left">
                        {repo.language && (
                          <span>
                            <div
                              className="language"
                              style={{ backgroundColor: getLanguageColor(repo.language) }}
                            />
                            {repo.language}
                          </span>
                        )}
                        <span>
                          <StarIcon />
                          {repo.stargazers_count.toLocaleString()}
                        </span>
                        <span>
                          <RepoForkedIcon />
                          {repo.forks_count.toLocaleString()}
                        </span>
                      </div>
                      <div className="repo__stats--right">
                        <span>{repo.size.toLocaleString()} KB</span>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>No available repositories!</p>
          )}
        </div>
      </ReposStyles>
    </Section>
  );
};

Repos.propTypes = {
  repoData: PropTypes.array.isRequired,
};

export default Repos;
